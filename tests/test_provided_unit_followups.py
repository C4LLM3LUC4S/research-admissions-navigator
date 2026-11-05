import importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('provided_entry_builder',Path(__file__).resolve().parents[1]/'scripts/build_catalog.py');b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)

class ProvidedFollowupTests(unittest.TestCase):
    def test_an_unprovided_alternative_cannot_become_a_unit_followup(self):
        c=b.build_catalog();row=next(e for e in c['academicEntryFollowups'] if '/department-of-architecture/' in e['url']);row['url']='https://unobserved.example/department/'
        with self.assertRaises(AssertionError):b.validate(c)

    def test_a_next_step_not_present_in_the_actual_body_is_rejected(self):
        c=b.build_catalog();row=next(e for e in c['academicEntryFollowups'] if '/department-of-architecture/' in e['url']);row['nextEntries'][0]['url']='https://www.arch.hku.hk/not-provided/'
        with self.assertRaisesRegex(AssertionError,'provided by the actual unit body'):b.validate(c)

    def test_a_supplied_entry_cannot_borrow_another_body_or_date(self):
        for field,value in [('bodySha256','0'*64),('checkedAt','2026-11-06')]:
            with self.subTest(field=field):
                c=b.build_catalog();row=next(e for e in c['academicEntryFollowups'] if '/department-of-architecture/' in e['url']);row[field]=value
                with self.assertRaisesRegex(AssertionError,'retain its actual body and date'):b.validate(c)

if __name__=='__main__':unittest.main()
