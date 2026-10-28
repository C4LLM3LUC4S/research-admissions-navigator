import copy
import importlib.util
import json
import tempfile
import unittest
import zipfile
from pathlib import Path

spec = importlib.util.spec_from_file_location("release", Path(__file__).parents[1] / "scripts/publish_release.py")
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)
TAG, SOURCE, TREE = "v0.1.0a10", "a" * 40, "b" * 40


def asset(name, data):
    return {"name": name, "size": len(data), "digest": "sha256:" + release.sha(data), "state": "uploaded"}


class Remote:
    def __init__(self, files, published=False, assets=()):
        self.files, self.calls = files, []
        self.row = {"id": 42, "url": "https://api.github.com/repos/" + release.REPOSITORY + "/releases/42",
                    "html_url": "https://github.com/" + release.REPOSITORY + "/releases/tag/" + TAG,
                    "tag_name": TAG, "target_commitish": SOURCE, "draft": not published, "prerelease": True,
                    "assets": [asset(n, files[n]) for n in assets]}

    def find(self, tag):
        return copy.deepcopy(self.row)

    def request(self, method, path, data=None, binary=False):
        self.calls.append((method, path))
        if method == "POST":
            name = path.split("name=")[1]
            self.row["assets"].append(asset(name, data))
        if method == "PATCH":
            self.row["draft"] = data["draft"]
        return copy.deepcopy(self.row)


class PublicationTests(unittest.TestCase):
    def setUp(self):
        self.files = {"package.zip": b"complete original package", "RELEASE_INFO.json": b"original identity", "SHA256SUMS": b"checksums"}

    def run_publish(self, api):
        return release.publish(api, TAG, SOURCE, "研向", "source notes", self.files)

    def test_partial_draft_resumes_only_missing_assets_then_publishes(self):
        api = Remote(self.files, assets=["package.zip"])
        self.assertEqual(self.run_publish(api)["status"], "published_checked_assets")
        writes = [path for method, path in api.calls if method == "POST"]
        self.assertEqual(len(writes), 2)
        self.assertFalse(any("package.zip" in path for path in writes))
        self.assertEqual(api.calls[-1][0], "PATCH")

    def test_published_release_is_checked_without_mutations(self):
        api = Remote(self.files, published=True, assets=list(self.files))
        self.assertEqual(self.run_publish(api)["status"], "already_published_unchanged")
        self.assertEqual(api.calls, [])

    def test_wrong_repository_source_tag_or_scope_refuses_before_writes(self):
        for key, value in [("url", "https://api.github.com/repos/other/repo/releases/42"), ("target_commitish", "other-source"),
                           ("tag_name", "v0.1.0a9"), ("prerelease", False)]:
            with self.subTest(key=key):
                api = Remote(self.files)
                api.row[key] = value
                with self.assertRaises(ValueError):
                    self.run_publish(api)
                self.assertEqual(api.calls, [])

    def test_different_or_unexpected_remote_asset_is_never_replaced(self):
        for bad in [asset("package.zip", b"old bytes"), asset("private.txt", b"unexpected")]:
            api = Remote(self.files)
            api.row["assets"] = [bad]
            with self.assertRaises(ValueError):
                self.run_publish(api)
            self.assertEqual(api.calls, [])

    def test_upload_failure_preserves_draft_and_no_automatic_mutation_retry(self):
        api = Remote(self.files)
        original = api.request
        def fail(method, path, data=None, binary=False):
            if method == "POST":
                api.calls.append((method, path))
                raise RuntimeError("simulated interrupted upload")
            return original(method, path, data, binary)
        api.request = fail
        with self.assertRaises(RuntimeError):
            self.run_publish(api)
        self.assertEqual(len(api.calls), 1)
        self.assertTrue(api.row["draft"])

    def test_remote_readback_mismatch_keeps_draft(self):
        api = Remote(self.files)
        original = api.request
        def mismatch(method, path, data=None, binary=False):
            row = original(method, path, data, binary)
            if method == "GET":
                row["assets"][0]["digest"] = "sha256:wrong"
            return row
        api.request = mismatch
        with self.assertRaises(ValueError):
            self.run_publish(api)
        self.assertTrue(api.row["draft"])
        self.assertFalse(any(method == "PATCH" for method, path in api.calls))

    def test_missing_tag_endpoint_checks_existing_draft_list(self):
        api = release.GitHub("unused-test-value")
        paths = []
        row = Remote(self.files).row
        def request(method, path):
            paths.append(path)
            return None if "/tags/" in path else [row]
        api.request = request
        self.assertEqual(api.find(TAG)["id"], 42)
        self.assertEqual(len(paths), 2)

    def test_new_release_is_created_once_as_draft_before_assets(self):
        api = Remote(self.files)
        api.find = lambda tag: None
        original = api.request
        def create(method, path, data=None, binary=False):
            if method == "POST" and path.endswith("/releases"):
                api.calls.append((method, path))
                self.assertIs(data["draft"], True)
                self.assertIs(data["prerelease"], True)
                self.assertEqual(data["target_commitish"], SOURCE)
                return copy.deepcopy(api.row)
            return original(method, path, data, binary)
        api.request = create
        self.assertEqual(self.run_publish(api)["status"], "published_checked_assets")
        self.assertEqual(len([p for m, p in api.calls if m == "POST" and p.endswith("/releases")]), 1)

    def test_bounded_release_lookup_never_treats_incomplete_listing_as_absent(self):
        api = release.GitHub("unused-test-value")
        paths = []
        def request(method, path):
            paths.append(path)
            return None if "/tags/" in path else [{"tag_name": "another-tag"}] * 100
        api.request = request
        with self.assertRaises(ValueError):
            api.find(TAG)
        self.assertEqual(len(paths), 4)

    def test_bundle_hash_and_identity_checked_before_any_network(self):
        with tempfile.TemporaryDirectory() as temp:
            folder = Path(temp)
            name = "Yanxiang-0.1.0a10-offline.zip"
            build = {"source_commit": SOURCE, "source_tree": TREE, "catalog_snapshot": "test-snapshot", "publicly_deployed": None}
            members = {"BUILD_INFO.json": json.dumps(build).encode(), "source/STATUS.json": b'{"version":"0.1.0a10"}'}
            manifest = {"source_commit": SOURCE, "files": {n: {"bytes": len(d), "sha256": release.sha(d)} for n, d in members.items()}}
            with zipfile.ZipFile(folder / name, "w") as z:
                for n, d in members.items():
                    z.writestr(n, d)
                z.writestr("MANIFEST.json", json.dumps(manifest))
            data = (folder / name).read_bytes()
            info = {**build, "release_tag": TAG, "version": TAG[1:], "repository_url": "https://github.com/" + release.REPOSITORY,
                    "archive": name, "bytes": len(data), "sha256": release.sha(data)}
            (folder / "RELEASE_INFO.json").write_text(json.dumps(info), encoding="utf-8")
            files = {name: data, "RELEASE_INFO.json": (folder / "RELEASE_INFO.json").read_bytes()}
            (folder / "SHA256SUMS").write_bytes("".join(release.sha(d) + "  " + n + "\n" for n, d in files.items()).encode())
            self.assertEqual(len(release.bundle_files(folder, TAG, SOURCE, TREE)[1]), 3)
            with self.assertRaises(ValueError):
                release.bundle_files(folder, TAG, "c" * 40, TREE)
            (folder / name).write_bytes(data + b"changed")
            with self.assertRaises(ValueError):
                release.bundle_files(folder, TAG, SOURCE, TREE)


if __name__ == "__main__":
    unittest.main()
