import unittest,importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('institution_builder',Path(__file__).resolve().parents[1]/'scripts/build_catalog.py')
b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
class InstitutionalReferenceChecks(unittest.TestCase):
    def test_unrelated_source_cannot_certify_supplied_links(self):
        c=b.build_catalog();r=next(m for m in c['academicCoverage']if m['universityId']=='hkust')['institutionalReferences'][0]
        r['entries'][0]['url']='https://example.com/invented-department'
        with self.assertRaisesRegex(AssertionError,'provided by its own source'):b.validate(c)
    def test_link_does_not_become_read_or_a_facility_become_department(self):
        for field,value,message in [('bodyStatus','body_read','supplied link'),('kind','facility','Do not mix')]:
            with self.subTest(field=field):
                c=b.build_catalog();r=next(m for m in c['academicCoverage']if m['universityId']=='hkust')['institutionalReferences'][0];r['entries'][0][field]=value
                with self.assertRaisesRegex(AssertionError,message):b.validate(c)
if __name__=='__main__':unittest.main()
