import copy,importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('college_model_builder',Path(__file__).resolve().parents[1]/'scripts/build_catalog.py')
b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
class CollegeModelSourceChecks(unittest.TestCase):
    def test_unitary_model_cannot_borrow_a_general_mission_page(self):
        c=b.build_catalog();u=next(u for m in c['academicCoverage']for u in m['units']if u['id']=='cuhk-5')
        u['organizationReview']['modelSourceIds']=['scope-cuhk-law-mission-20261102']
        with self.assertRaisesRegex(AssertionError,'explicit official source'):b.validate(c)
if __name__=='__main__':unittest.main()
