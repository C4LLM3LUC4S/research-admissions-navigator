"""New scope actions need their own actual body receipt and cannot borrow another college."""
import copy,importlib.util,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('scope_builder',Path(__file__).resolve().parents[1]/'scripts/build_catalog.py')
builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)
class ScopeActionChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):cls.catalog=builder.build_catalog()
    def test_action_cannot_borrow_another_colleges_existing_source(self):
        c=copy.deepcopy(self.catalog)
        u=next(u for m in c['academicCoverage']for u in m['units']if u['id']=='cuhk-zhizhen')
        u['reviewedNavigation'][0]['sourceId']='scope-cuhk-law-2027-notice-20261102'
        with self.assertRaisesRegex(AssertionError,'actual scope source'):builder.validate(c)
    def test_action_requires_actual_body_hash_and_source_kind(self):
        for field,value in [('bodySha256','not-a-body'),('readMethod','not_read')]:
            c=copy.deepcopy(self.catalog)
            s=next(s for s in c['sources']if s['id']=='scope-zhizhen-academics-20261102');s[field]=value
            with self.assertRaises(AssertionError):builder.validate(c)
if __name__=='__main__':unittest.main()
