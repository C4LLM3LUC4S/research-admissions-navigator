import unittest,importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('law_business_builder',Path(__file__).resolve().parents[1]/'scripts/build_catalog.py')
b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
class LawBusinessSources(unittest.TestCase):
    def test_hku_cannot_borrow_cuhk_unitary_model(self):
        c=b.build_catalog();org=next(u for m in c['academicCoverage']for u in m['units']if u['id']=='hku-7')['organizationReview'];other='organization-law-unitary-20261104';org['sourceIds'].append(other);org['modelSourceIds']=[other]
        with self.assertRaisesRegex(AssertionError,'own explicit official source'):b.validate(c)
    def test_effective_date_cannot_be_replaced_by_read_date(self):
        c=b.build_catalog();org=next(u for m in c['academicCoverage']for u in m['units']if u['id']=='hku-7')['organizationReview'];org['effectiveFrom']=org['checkedAt']
        with self.assertRaisesRegex(AssertionError,'own effective date and scope'):b.validate(c)
    def test_https_address_cannot_be_guessed_from_the_old_http(self):
        c=b.build_catalog();child=next(u for m in c['academicCoverage']for u in m['units']if u['id']=='cityu-2')['children'][0];child['providedEntries'][0]['url']='https://www.cityu.edu.hk/ac/'
        with self.assertRaisesRegex(AssertionError,'Extra college entry not supplied'):b.validate(c)
if __name__=='__main__':unittest.main()
