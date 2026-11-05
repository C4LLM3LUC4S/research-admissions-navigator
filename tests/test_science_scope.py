import unittest,copy,importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('science_builder',Path(__file__).resolve().parents[1]/'scripts/build_catalog.py')
b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
class ScienceScopeChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.catalog=b.build_catalog()
    def science(self,c):return next(u for m in c['academicCoverage']for u in m['units']if u['id']=='hku-9')
    def test_read_date_cannot_replace_brochure_year(self):
        c=copy.deepcopy(self.catalog);self.science(c)['organizationReview']['sourceAcademicYear']='2027/28'
        with self.assertRaisesRegex(AssertionError,'own source academic year'):b.validate(c)
    def test_scds_departments_cannot_be_moved_to_a_different_parent(self):
        c=copy.deepcopy(self.catalog);self.science(c)['relatedNavigationGroups'][0]['parentUnitName']='School of Innovation'
        with self.assertRaisesRegex(AssertionError,'actual parent'):b.validate(c)
    def test_unprovided_department_address_cannot_be_invented(self):
        c=copy.deepcopy(self.catalog);self.science(c)['relatedNavigationGroups'][0]['entries'][0]['url']='https://invented.hku.hk/'
        with self.assertRaises(AssertionError):b.validate(c)
if __name__=='__main__':unittest.main()
