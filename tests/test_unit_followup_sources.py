import unittest,importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('unit_followup_builder',Path(__file__).resolve().parents[1]/'scripts/build_catalog.py')
b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
class UnitFollowupSourceChecks(unittest.TestCase):
    def test_read_cannot_borrow_another_units_body(self):
        c=b.build_catalog();c['academicEntryFollowups'][0]['sourceIds']=c['academicEntryFollowups'][1]['sourceIds']
        with self.assertRaisesRegex(AssertionError,'own original and actual URL'):b.validate(c)
    def test_failed_handshake_cannot_gain_a_body_hash(self):
        c=b.build_catalog();r=next(r for r in c['academicEntryFollowups']if r['bodyStatus']=='read_failed');r['bodySha256']='0'*64
        with self.assertRaisesRegex(AssertionError,'no response body receipt'):b.validate(c)
if __name__=='__main__':unittest.main()
