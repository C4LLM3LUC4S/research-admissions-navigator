import copy,unittest,importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('college_links_builder',Path(__file__).resolve().parents[1]/'scripts/build_catalog.py');b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
class CollegeLinkBoundaries(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.c=b.build_catalog()
    def unit(self,c,id):return next(u for m in c['academicCoverage']for u in m['units']if u['id']==id)
    def test_known_other_department_url_cannot_be_assigned_to_computer_science(self):
        c=copy.deepcopy(self.c);g=self.unit(c,'hku-9')['relatedNavigationGroups'][0];g['entries'][1]['url']=g['entries'][0]['url']
        with self.assertRaisesRegex(AssertionError,'name and URL pairing'):b.validate(c)
    def test_tie_cannot_inherit_phd_from_the_preceding_six_programmes(self):
        c=copy.deepcopy(self.c);g=next(g for g in self.unit(c,'hkust-6')['relatedNavigationGroups']if g['kind']=='research_degree_navigation');g['entries'][-1]['offeredDegrees']=['MPhil','PhD']
        with self.assertRaisesRegex(AssertionError,'own observed degree kinds'):b.validate(c)
if __name__=='__main__':unittest.main()
