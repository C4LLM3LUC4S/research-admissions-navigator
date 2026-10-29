"""Synthetic metadata checks; these do not recheck or redate any official page."""
import copy
import hashlib
import importlib.util
import re
import unittest
from datetime import date, timedelta
from pathlib import Path

spec = importlib.util.spec_from_file_location("catalog_builder", Path(__file__).resolve().parents[1] / "scripts/build_catalog.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class SourceDateChecks(unittest.TestCase):
    def test_directory_research_must_keep_its_actual_named_card_and_null_url(self):
        for key, value in [('name', 'Other person'), ('universityId', 'hku'), ('profileUrl', 'https://www.ee.cityu.edu.hk/'), ('sourceIds', [])]:
            with self.subTest(key=key):
                catalog = copy.deepcopy(self.catalog)
                row = next(f for f in catalog['faculty'] if f['id'] == 'cityu-ee-39')
                row[key] = value
                with self.assertRaises(AssertionError):
                    builder.validate(catalog)

    def test_null_profile_without_directory_contract_is_rejected(self):
        row = next(f for f in self.catalog['faculty'] if f['id'] == 'cityu-ee-39')
        del row['recordKind']
        with self.assertRaises(AssertionError):
            builder.validate(self.catalog)

    def test_declared_html_refresh_cannot_change_its_recorded_target(self):
        source = next(s for s in self.catalog['sources'] if s.get('navigationEvidence'))
        source['navigationEvidence']['declaredTarget'] = 'https://unrelated.example/'
        with self.assertRaises(AssertionError):
            builder.validate(self.catalog)

    def test_declared_html_refresh_keeps_the_original_body_and_teacher(self):
        source = next(s for s in self.catalog['sources'] if s.get('navigationEvidence'))
        source['navigationEvidence']['bodySha256'] = '0' * 64
        with self.assertRaises(AssertionError):
            builder.validate(self.catalog)

    def test_a_recorded_redirect_cannot_be_reassigned_to_another_teacher(self):
        f = next(f for f in self.catalog['faculty'] if f['id'] == 'cuhk-seem-01')
        link = f['extraLinks'][0]
        source = next(s for s in self.catalog['sources'] if s['id'] == link['sourceId'])
        source['parentSourceId'] = 'seem-profile-03-20261028'
        with self.assertRaises(AssertionError):
            builder.validate(self.catalog)

    def test_a_redirect_needs_the_actual_original_url_not_a_guessed_upgrade(self):
        f = next(f for f in self.catalog['faculty'] if f['id'] == 'cuhk-seem-01')
        source = next(s for s in self.catalog['sources'] if s['id'] == f['extraLinks'][0]['sourceId'])
        source['originalUrl'] = 'http://another.example/'
        with self.assertRaises(AssertionError):
            builder.validate(self.catalog)

    def setUp(self):
        self.catalog = builder.build_catalog()

    def test_older_verification_date_survives_a_newer_catalogue(self):
        original = copy.deepcopy(self.catalog)
        self.catalog["sources"][0]["checkedAt"] = "2026-10-25"
        self.assertEqual(builder.validate(self.catalog)["status"], "passed")
        self.assertEqual(self.catalog["sources"][0]["checkedAt"], "2026-10-25")
        self.assertEqual(self.catalog["checkedDate"], original["checkedDate"])

    def test_a_future_verification_date_is_rejected(self):
        self.catalog["sources"][0]["checkedAt"] = (date.fromisoformat(self.catalog["checkedDate"]) + timedelta(days=1)).isoformat()
        with self.assertRaises(AssertionError):
            builder.validate(self.catalog)

    def test_new_census_does_not_re_date_unvisited_policy_sources(self):
        rgc = [s for s in self.catalog['sources'] if s['id'] in {'rgc-hkpfs-2027', 'rgc-hkpfs-institutions'}]
        self.assertEqual(len(rgc), 2)
        self.assertTrue(all(s['checkedAt'] == '2026-10-26' for s in rgc))
        self.assertEqual(self.catalog['checkedDate'], builder.CHECKED)

    def test_web_reader_receipt_cannot_be_relabeled_as_raw_http(self):
        row = next(s for s in self.catalog['sources'] if s['id'].startswith('cityu-dao-profile-'))
        row['bodySha256'] = row['readReceiptSha256']
        with self.assertRaises(AssertionError):
            builder.validate(self.catalog)

    def test_web_reader_requires_explicit_text_receipt_scope(self):
        row = next(s for s in self.catalog['sources'] if s['id'].startswith('cityu-dao-profile-'))
        row.pop('receiptKind')
        with self.assertRaises(AssertionError):
            builder.validate(self.catalog)

    def test_a_directory_link_cannot_be_attached_to_another_teacher(self):
        teacher = next(f for f in self.catalog['faculty'] if f['name'] == '邓淇元')
        parent = next(s for s in self.catalog['sources'] if s['id'] == 'cuhksz-sme-directory-20261028')
        parent['teacherLinksByProfile'][teacher['profileUrl']] = []
        with self.assertRaises(AssertionError):
            builder.validate(self.catalog)

    def test_dated_teacher_notice_requires_exact_intake_and_teacher_source(self):
        teacher = next(f for f in self.catalog['faculty'] if f['availability'].get('noticeKind') == 'dated_teacher_statement')
        teacher['availability']['intake'] = '2027 Spring'
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
        self.census = next(d['census'] for d in self.catalog['directories'] if d['id'] == 'census-hkust-cbe-all-categories')

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


class AcademicMapChecks(unittest.TestCase):
    def setUp(self):
        self.catalog = builder.build_catalog()

    def test_subject_navigation_cannot_be_relabelled_a_department(self):
        u = next(u for m in self.catalog['academicCoverage'] for u in m['units'] if u['id'] == 'cuhksz-4')
        u['relatedNavigationGroups'][0]['entries'][0]['kind'] = 'department'
        with self.assertRaises(AssertionError):
            builder.validate(self.catalog)

    def test_unlinked_component_still_needs_its_actual_parent_name(self):
        u = next(u for m in self.catalog['academicCoverage'] for u in m['units'] if u['id'] == 'hkustgz-6')
        u['relatedNavigationGroups'][0]['entries'][0]['observedName'] = 'Invented Department'
        with self.assertRaises(AssertionError):
            builder.validate(self.catalog)

    def test_scoped_organization_review_cannot_assert_complete_structure(self):
        u = next(u for m in self.catalog['academicCoverage'] for u in m['units'] if u['id'] == 'cuhksz-2')
        u['organizationReview']['organizationComplete'] = True
        with self.assertRaises(AssertionError):
            builder.validate(self.catalog)

    def test_child_link_not_supplied_by_actual_parent_is_rejected(self):
        u = next(u for m in self.catalog['academicCoverage'] for u in m['units'] if u['id'] == 'hku-9')
        u['children'][0]['url'] = 'https://unobserved.example/department'
        with self.assertRaises(AssertionError):
            builder.validate(self.catalog)

    def test_affiliated_school_cannot_be_relabelled_direct(self):
        u = next(u for m in self.catalog['academicCoverage'] for u in m['units'] if u['id'] == 'hku-9')
        c = next(c for c in u['children'] if c['kind'] == 'affiliated_school')
        c['relationship'] = 'direct_academic_unit'
        with self.assertRaises(AssertionError):
            builder.validate(self.catalog)

    def test_matched_child_list_cannot_assert_teacher_census(self):
        u = next(u for m in self.catalog['academicCoverage'] for u in m['units'] if u['id'] == 'hkust-6')
        u['childInventoryReview']['facultyComplete'] = True
        with self.assertRaises(AssertionError):
            builder.validate(self.catalog)

    def test_college_scope_cannot_drop_the_academy_from_its_observed_list(self):
        m = next(m for m in self.catalog['academicCoverage'] if m['universityId'] == 'cityu')
        m['listReview']['academicUnitIds'].remove('cityu-innovation')
        m['listReview']['academicUnitsListed'] -= 1
        with self.assertRaises(AssertionError):
            builder.validate(self.catalog)

    def test_matching_a_college_list_cannot_claim_departments_are_complete(self):
        self.catalog['academicCoverage'][0]['listReview']['wholeUniversityHierarchyComplete'] = True
        with self.assertRaises(AssertionError):
            builder.validate(self.catalog)

    def test_seven_school_maps_keep_typed_counts_and_separate_support_units(self):
        maps = {r['universityId']: r for r in self.catalog['academicCoverage']}
        self.assertEqual(len(maps), 7)
        self.assertEqual(len(maps['hku']['units']), 10)
        self.assertEqual(len(maps['cuhksz']['units']), 9)
        self.assertEqual([c['value'] for c in maps['hkustgz']['reportedCounts']], [4, 2, 1])
        self.assertTrue(all(r['coverageComplete'] is False for r in maps.values()))
        for row in maps.values():
            for unit in row['units']:
                if unit['kind'] in {'graduate_school', 'undergraduate_college'}:
                    self.assertEqual(unit['teacherReviewStatus'], 'not_applicable')
        self.assertEqual(maps['cityu']['structureStatus'], 'partial_cross_checked')

    def test_an_unknown_faculty_total_cannot_silently_become_zero(self):
        self.catalog['academicCoverage'][0]['units'][0]['teacherProfilesTotal'] = 0
        with self.assertRaises(AssertionError):
            builder.validate(self.catalog)

    def test_claiming_a_read_entry_needs_its_actual_source(self):
        unit = self.catalog['academicCoverage'][0]['units'][0]
        self.assertEqual(unit['entryBodyStatus'], 'body_read')
        unit['sourceIds'] = []
        with self.assertRaises(AssertionError):
            builder.validate(self.catalog)

    def test_a_pending_personal_link_must_have_been_observed_on_that_directory(self):
        entry = next(e for r in self.catalog['academicCoverage'] for u in r['units'] for e in u['staffEntries'] if e.get('profileLeads'))
        self.assertTrue(all(p['profileBodyStatus'] in {'body_read', 'not_read', 'access_failed'} for p in entry['profileLeads']))
        entry['profileLeads'][0]['url'] = 'https://www.polyu.edu.hk/sd/not-observed/'
        with self.assertRaises(AssertionError):
            builder.validate(self.catalog)

    def test_a_reviewed_record_keeps_its_real_faculty_reference(self):
        entry = next(e for r in self.catalog['academicCoverage'] for u in r['units'] for e in u['staffEntries'] if e.get('profileLeads'))
        lead = next(p for p in entry['profileLeads'] if p.get('facultyId'))
        lead['facultyId'] = 'invented-adviser'
        with self.assertRaises(AssertionError):
            builder.validate(self.catalog)

    def test_staff_navigation_read_does_not_imply_complete_teacher_enumeration(self):
        self.assertEqual(self.catalog['academicEntryProgress']['childBodiesRead'], 108)
        self.assertEqual(self.catalog['academicEntryProgress']['childFailures'], 32)
        self.assertEqual(self.catalog['academicEntryProgress']['distinctStaffRoutes'], 107)
        child = next(c for r in self.catalog['academicCoverage'] for u in r['units'] for c in u['children'] if c.get('staffRoutes'))
        self.assertTrue(all(route['completeFacultyEnumeration'] is False for route in child['staffRoutes']))
        child['staffRoutes'][0]['completeFacultyEnumeration'] = True
        with self.assertRaises(AssertionError):
            builder.validate(self.catalog)


class DirectoryPendingChecks(unittest.TestCase):
    def test_pending_reasons_must_account_for_the_actual_unread_profiles(self):
        catalog = builder.build_catalog()
        cse = next(d for d in catalog['directories'] if d['id'] == 'wide-dir-cuhk-cse')['census']
        cse['pendingReasonCounts']['originalHTTP'] = 7
        with self.assertRaises(AssertionError):
            builder.validate(catalog)

    def test_an_unprovided_profile_url_cannot_be_invented_for_a_named_card(self):
        catalog = builder.build_catalog()
        cse = next(d for d in catalog['directories'] if d['id'] == 'wide-dir-cuhk-cse')['census']
        cse['unlinkedEntries'][0]['profileUrl'] = 'https://www.cse.cuhk.edu.hk/guessed'
        with self.assertRaises(AssertionError):
            builder.validate(catalog)


class LegacyEvidenceChecks(unittest.TestCase):
    def test_http_evidence_needs_actual_response_and_explicit_nonclickable_scope(self):
        catalog = builder.build_catalog()
        source = next(s for s in catalog['sources'] if s['id'] == 'bme-profile-24-20261028')
        self.assertEqual(source['url'], source['retrievedUrl'])
        self.assertEqual(builder.validate(catalog)['status'], 'passed')
        source.pop('transportScope')
        with self.assertRaises(AssertionError):
            builder.validate(catalog)

    def test_http_evidence_cannot_borrow_a_different_returned_url_or_missing_body(self):
        for field, value in [('retrievedUrl', 'https://unverified.example/'), ('bodySha256', '')]:
            catalog = builder.build_catalog()
            source = next(s for s in catalog['sources'] if s['id'] == 'bme-profile-24-20261028')
            source[field] = value
            with self.assertRaises(AssertionError):
                builder.validate(catalog)


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


class AccessResponseChecks(unittest.TestCase):
    def test_access_checks_stay_unread_without_erasing_original_links_or_dates(self):
        catalog = builder.build_catalog()
        rows = [c for m in catalog['academicCoverage'] for u in m['units'] for c in u['children'] if c.get('responseKind') == 'access_challenge']
        self.assertEqual(len(rows), 20)
        self.assertTrue(all(c['entryBodyStatus'] == 'access_failed' and c['url'] and c['teacherProfilesTotal'] is None for c in rows))
        old_ids = {sid for row in builder.load('entry-access-review-20261027.json')['entries'] for sid in row['sourceIds']}
        sources = [s for s in catalog['sources'] if s['id'] in old_ids]
        self.assertEqual(len(sources), 5)
        self.assertTrue(all(s['evidenceLevel'] == 'official_entry_access_failed' for s in sources))
        self.assertTrue(all(s['checkedAt'] == '2026-10-26' and s['classificationReviewedAt'] == '2026-10-27' for s in sources))
        self.assertEqual(catalog['academicEntryProgress']['knownAccessChallenges'], 20)

    def test_known_access_checks_cannot_be_promoted_to_verified_sources_or_read_entries(self):
        catalog = builder.build_catalog()
        source = next(s for s in catalog['sources'] if s.get('responseKind') == 'access_challenge')
        source['evidenceLevel'] = 'official_verified_page_scoped'
        with self.assertRaisesRegex(AssertionError, 'access-check'):
            builder.validate(catalog)
        catalog = builder.build_catalog()
        child = next(c for m in catalog['academicCoverage'] for u in m['units'] for c in u['children'] if c.get('responseKind') == 'access_challenge')
        child['entryBodyStatus'] = 'body_read'
        with self.assertRaisesRegex(AssertionError, 'access checks'):
            builder.validate(catalog)


if __name__ == "__main__":
    unittest.main()
