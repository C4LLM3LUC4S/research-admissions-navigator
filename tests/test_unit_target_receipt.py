"""A parent's observed URL cannot be substituted for the target unit's body."""
import copy, importlib.util, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('unit_target_builder',Path(__file__).resolve().parents[1]/'scripts/build_catalog.py')
builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)
class UnitTargetReceiptChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls): cls.catalog=builder.build_catalog()
    def landscape(self,c):
        return next(u for m in c['academicCoverage']for u in m['units']if u['id']=='hku-1')['relatedNavigationGroups'][0]['entries'][0]
    def test_read_target_cannot_borrow_parent_body_and_url(self):
        c=copy.deepcopy(self.catalog);e=self.landscape(c)
        parent=next(s for s in c['sources']if s['id']=='deep-hku-architecture-ke-20261102')
        e['bodySha256']=parent['bodySha256'];e['retrievedUrl']=parent['url']
        with self.assertRaisesRegex(AssertionError,'own exact target body'):builder.validate(c)
    def test_unread_receipt_does_not_become_a_read_target(self):
        c=copy.deepcopy(self.catalog);self.landscape(c)['readMethod']='not_read'
        with self.assertRaises(AssertionError):builder.validate(c)
if __name__=='__main__':unittest.main()
