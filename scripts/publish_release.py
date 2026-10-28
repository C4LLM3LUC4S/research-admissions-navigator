"""Publish a checked offline alpha from an existing tag; never replace remote assets."""
import argparse
import hashlib
import json
import os
import re
import subprocess
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path, PurePosixPath

REPOSITORY = "C4LLM3LUC4S/research-admissions-navigator"


def sha(data):
    return hashlib.sha256(data).hexdigest()


def bundle_files(folder, tag, source, tree):
    info = json.loads((folder / "RELEASE_INFO.json").read_text(encoding="utf-8"))
    if not re.fullmatch(r"v\d+\.\d+\.\d+a\d+", tag):
        raise ValueError("Only an explicit alpha tag can be published")
    if (info["release_tag"], info["version"], info["source_commit"], info["source_tree"]) != (tag, tag[1:], source, tree):
        raise ValueError("Package, tag and checked source do not match")
    if info["repository_url"] != "https://github.com/" + REPOSITORY:
        raise ValueError("Wrong package repository")
    name = info["archive"]
    if name != "Yanxiang-" + tag[1:] + "-offline.zip":
        raise ValueError("Unexpected archive name")
    data = (folder / name).read_bytes()
    if len(data) != info["bytes"] or sha(data) != info["sha256"]:
        raise ValueError("Archive bytes do not match release information")
    with zipfile.ZipFile(folder / name) as z:
        if len(z.namelist()) != len(set(z.namelist())) or z.testzip() is not None:
            raise ValueError("Corrupt or duplicate archive member")
        manifest = json.loads(z.read("MANIFEST.json"))
        build = json.loads(z.read("BUILD_INFO.json"))
        if manifest["source_commit"] != source or build["source_commit"] != source or build["source_tree"] != tree:
            raise ValueError("Archived source identity differs")
        if build["catalog_snapshot"] != info["catalog_snapshot"] or build["publicly_deployed"] is not None:
            raise ValueError("Snapshot or deployment scope differs")
        if set(z.namelist()) != set(manifest["files"]) | {"MANIFEST.json"}:
            raise ValueError("Archive member list differs from manifest")
        for member, expected in manifest["files"].items():
            path = PurePosixPath(member)
            if path.is_absolute() or ".." in path.parts or "\\" in member:
                raise ValueError("Unsafe archive path")
            payload = z.read(member)
            if len(payload) != expected["bytes"] or sha(payload) != expected["sha256"]:
                raise ValueError("Archive member digest differs")
        if json.loads(z.read("source/STATUS.json"))["version"] != tag[1:]:
            raise ValueError("Archived version differs")
    files = {name: data, "RELEASE_INFO.json": (folder / "RELEASE_INFO.json").read_bytes()}
    sums = "".join(sha(payload) + "  " + key + "\n" for key, payload in files.items()).encode("ascii")
    recorded_sums = (folder / "SHA256SUMS").read_bytes()
    if recorded_sums.decode("ascii").splitlines() != sums.decode("ascii").splitlines():
        raise ValueError("Checksum file differs")
    files["SHA256SUMS"] = recorded_sums
    return info, files


class GitHub:
    def __init__(self, token):
        self.token = token

    def request(self, method, path, data=None, binary=False):
        host = "https://uploads.github.com" if binary else "https://api.github.com"
        payload = data if binary else (json.dumps(data).encode() if data is not None else None)
        headers = {"Authorization": "Bearer " + self.token, "User-Agent": "Yanxiang-release",
                   "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"}
        if payload is not None:
            headers["Content-Type"] = "application/octet-stream" if binary else "application/json"
        try:
            with urllib.request.urlopen(urllib.request.Request(host + path, payload, headers, method=method), timeout=120) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if method == "GET" and e.code == 404:
                return None
            raise RuntimeError(f"GitHub HTTP {e.code}; inspect remote state before another write") from None

    def find(self, tag):
        prefix = "/repos/" + REPOSITORY + "/releases"
        release = self.request("GET", prefix + "/tags/" + tag)
        if release:
            return release
        # Drafts may not be returned by the tag endpoint. Search a bounded listing before creating anything.
        for page in range(1, 4):
            rows = self.request("GET", prefix + f"?per_page=100&page={page}")
            if rows is None:
                raise ValueError("Cannot inspect releases")
            matches = [r for r in rows if r["tag_name"] == tag]
            if len(matches) > 1:
                raise ValueError("Ambiguous release tag")
            if matches:
                return matches[0]
            if len(rows) < 100:
                return None
        raise ValueError("Release listing bound reached; manual review required")


def check_release(release, tag, source):
    prefix = "https://api.github.com/repos/" + REPOSITORY + "/releases/"
    if not (isinstance(release.get("id"), int) and release["id"] > 0 and
            release.get("url") == prefix + str(release["id"]) and release.get("tag_name") == tag and
            release.get("target_commitish") == source and release.get("prerelease") is True):
        raise ValueError("Release identity or scope differs; remote left untouched")


def check_assets(release, files, complete=False):
    seen = set()
    for asset in release.get("assets", []):
        name = asset["name"]
        if name in seen or name not in files:
            raise ValueError("Unexpected or duplicate remote asset; remote left untouched")
        seen.add(name)
        if (asset.get("state"), asset.get("size"), asset.get("digest")) != ("uploaded", len(files[name]), "sha256:" + sha(files[name])):
            raise ValueError("Remote asset differs; never overwrite or delete it")
    if complete and seen != set(files):
        raise ValueError("Remote asset set is incomplete")
    return seen


def publish(api, tag, source, title, notes, files):
    prefix = "/repos/" + REPOSITORY + "/releases"
    release = api.find(tag)
    if release is None:
        release = api.request("POST", prefix, {"tag_name": tag, "target_commitish": source, "name": title,
                             "body": notes, "draft": True, "prerelease": True, "make_latest": "false"})
    check_release(release, tag, source)
    seen = check_assets(release, files)
    if not release["draft"]:
        check_assets(release, files, complete=True)
        return {"status": "already_published_unchanged", "id": release["id"], "url": release["html_url"]}
    for name, payload in files.items():
        if name not in seen:
            api.request("POST", prefix + "/" + str(release["id"]) + "/assets?name=" + urllib.parse.quote(name), payload, binary=True)
    current = api.request("GET", prefix + "/" + str(release["id"]))
    check_release(current, tag, source)
    check_assets(current, files, complete=True)
    if current["draft"]:
        current = api.request("PATCH", prefix + "/" + str(release["id"]), {"draft": False, "make_latest": "false"})
    check_release(current, tag, source)
    check_assets(current, files, complete=True)
    if current["draft"]:
        raise ValueError("Release still draft")
    return {"status": "published_checked_assets", "id": current["id"], "url": current["html_url"]}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--folder", type=Path, required=True)
    parser.add_argument("--tag", required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    def git(*parts):
        return subprocess.check_output(["git", *parts], cwd=root).decode().strip()
    if os.environ.get("GITHUB_ACTIONS") != "true" or os.environ.get("GITHUB_REPOSITORY") != REPOSITORY:
        raise ValueError("Publishing only runs in this repository's GitHub Actions")
    if os.environ.get("GITHUB_REF") != "refs/tags/" + args.tag:
        raise ValueError("Expected a tag-triggered run")
    source, tree = git("rev-parse", "HEAD"), git("rev-parse", "HEAD^{tree}")
    if source != os.environ.get("GITHUB_SHA") or git("rev-parse", args.tag + "^{commit}") != source:
        raise ValueError("Tag, workflow and checked source differ")
    subprocess.run(["git", "merge-base", "--is-ancestor", source, "origin/main"], cwd=root, check=True)
    info, files = bundle_files(args.folder, args.tag, source, tree)
    notes = (root / "releases" / (args.tag + ".md")).read_text(encoding="utf-8")
    notes += "\n\n对应源码：`" + source + "`；资料快照：`" + info["catalog_snapshot"] + "`。\n"
    result = publish(GitHub(os.environ["GITHUB_TOKEN"]), args.tag, source, "研向 " + args.tag, notes, files)
    (args.folder / "publication.json").write_text(json.dumps({**result, "source": source, "tree": tree}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
