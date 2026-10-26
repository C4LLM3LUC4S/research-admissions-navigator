"""Synthetic metadata checks; these do not recheck or redate any official page."""
import copy
import hashlib
import importlib.util
import re
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("catalog_builder", Path(__file__).resolve().parents[1] / "scripts/build_catalog.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class SourceDateChecks(unittest.TestCase):
    def setUp(self):
        self.catalog = builder.build_catalog()

    def test_older_verification_date_survives_a_newer_catalogue(self):
        original = copy.deepcopy(self.catalog)
        self.catalog["sources"][0]["checkedAt"] = "2026-10-25"
        self.assertEqual(builder.validate(self.catalog)["status"], "passed")
        self.assertEqual(self.catalog["sources"][0]["checkedAt"], "2026-10-25")
        self.assertEqual(self.catalog["checkedDate"], original["checkedDate"])

    def test_a_future_verification_date_is_rejected(self):
        self.catalog["sources"][0]["checkedAt"] = "2026-10-27"
        with self.assertRaises(AssertionError):
            builder.validate(self.catalog)

    def test_missing_or_invalid_dates_are_not_replaced_with_build_date(self):
        packs = [builder.load(name) for name in ("hku-cuhk.json", "hkust.json", "polyu-cityu-cuhksz.json")]
        raw = packs[0]["sources"][0]
        raw.pop("checked_date", None)
        raw.pop("checked_at", None)
        normalized = builder.normalize_sources(packs)
        self.assertIsNone(next(source for source in normalized if source["id"] == raw["id"])["checkedAt"])
        for invalid in [None, "", "2026-02-30", "2026-1-01"]:
            with self.subTest(date=invalid):
                self.catalog["sources"][0]["checkedAt"] = invalid
                with self.assertRaises((AssertionError, ValueError)):
                    builder.validate(self.catalog)


class QuantitativeProgrammeChecks(unittest.TestCase):
    def setUp(self):
        self.programs = {p["id"]: p for p in builder.build_catalog()["programs"]}

    def test_mathematics_keeps_its_own_deadlines_not_engineering_dates(self):
        math = self.programs["hkust-math-rpg"]
        autumn = [d for d in math["deadlines"] if d["degree"] is None and d["cycle"] == "2027/28"]
        self.assertEqual([(d["date"], d["at"]) for d in autumn], [("2027-06-01", None)])
        spring = [d for d in math["deadlines"] if d["cycle"] == "2026/27 Spring"]
        self.assertEqual({d["date"] for d in spring}, {"2026-11-01", "2026-12-15"})
        self.assertNotIn("2027-07-15", {d["date"] for d in math["deadlines"]})

    def test_business_mphil_is_not_a_standalone_application(self):
        for pid in ("hkust-fina-rpg", "hkust-is-rpg"):
            with self.subTest(programme=pid):
                p = self.programs[pid]
                self.assertIn("MPhil不单独招生", p["name"])
                items = {i["label"]: i for i in p["requirements"]}
                self.assertIn("网申选择PhD", items["MPhil不能单独申请"]["text"])
                self.assertIn("GMAT或GRE", items["另核GMAT或GRE"]["text"])
                self.assertEqual(p["contact"]["status"], "unknown")
                self.assertTrue(all(d["date"] == "2027-02-01" for d in p["deadlines"] if d["degree"] is None))

    def test_statistics_intent_is_post_submission_not_a_preconsent_claim(self):
        p = self.programs["cuhk-statistics-rpg"]
        self.assertEqual(p["contact"]["status"], "unknown")
        self.assertIn("正式网申后", p["contact"]["text"])
        self.assertTrue(all(i["sourceIds"] == ["cuhk-statistics-2027"] for i in p["requirements"]))
        self.assertFalse(any("CSE" in sid for sid in p["sourceIds"]))
        self.assertTrue(all(d["at"] is None for d in p["deadlines"] if d["degree"] is None))


class DirectoryCensusChecks(unittest.TestCase):
    def setUp(self):
        self.catalog = builder.build_catalog()
        self.census = self.catalog['directories'][-1]['census']

    def test_failed_reads_cannot_be_counted_as_read(self):
        self.census['profilesRead'] += 1
        with self.assertRaises(AssertionError):
            builder.validate(self.catalog)

    def test_duplicate_directory_urls_are_rejected(self):
        self.census['entries'][-1]['profileUrl'] = self.census['entries'][0]['profileUrl']
        with self.assertRaises(AssertionError):
            builder.validate(self.catalog)

    def test_personal_links_need_exact_parent_provenance_and_a_source_if_marked_read(self):
        f = next(f for f in self.catalog['faculty'] if f.get('extraLinks'))
        f['extraLinks'][0]['url'] = 'https://unobserved.example/profile'
        with self.assertRaises(AssertionError):
            builder.validate(self.catalog)


class PageAssetChecks(unittest.TestCase):
    def test_public_page_mirror_is_exactly_the_reviewed_offline_page(self):
        for name in ('index.html', 'catalog.js', 'logic.js', 'app.js', 'styles.css', 'discovery.css'):
            self.assertEqual((builder.ROOT / 'docs' / name).read_bytes(), (builder.ROOT / 'dist' / name).read_bytes(), name)
        self.assertTrue((builder.ROOT / 'docs/.nojekyll').is_file())

    def test_served_page_references_the_current_bytes_instead_of_an_older_cached_app(self):
        html = (builder.ROOT / 'dist/index.html').read_text(encoding='utf-8')
        for name in ('catalog.js', 'logic.js', 'app.js', 'styles.css', 'discovery.css'):
            digest = hashlib.sha256((builder.ROOT / 'dist' / name).read_bytes()).hexdigest()[:16]
            self.assertRegex(html, re.escape(name + '?v=' + digest))

    def test_a_copy_only_change_gets_a_new_reference_without_changing_catalogue_identity(self):
        html = '<script src="app.js"></script>'
        old = builder.asset_versioned_html(html, {'app.js': b'old copy'})
        new = builder.asset_versioned_html(old, {'app.js': b'new copy'})
        self.assertNotEqual(old, new)
        self.assertEqual(new, builder.asset_versioned_html(new, {'app.js': b'new copy'}))


if __name__ == "__main__":
    unittest.main()
