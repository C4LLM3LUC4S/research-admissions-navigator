import copy, importlib.util, unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('stem_note_builder',Path(__file__).resolve().parents[1]/'scripts/build_catalog.py');b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
class StemUnitNotes(unittest.TestCase):
    @classmethod
    def setUpClass(cls): cls.c=b.build_catalog()
    def test_announcement_cannot_invent_mphil(self):
        c=copy.deepcopy(self.c);c['academicUnitNotes'][0]['announcedProgrammes'].append(dict(degree='MPhil',year=2027))
        with self.assertRaisesRegex(AssertionError,'own degrees and years'):b.validate(c)
    def test_reused_staff_body_cannot_borrow_another_unit(self):
        c=copy.deepcopy(self.c);e=next(e for e in c['academicEntryFollowups']if e['url']=='http://www.polyu.edu.hk/ama/');r=next(r for r in e['nextEntries']if r['bodyStatus']=='body_read');r['sourceIds']=['entry-read-staff-route-8268d56c55e02854']
        with self.assertRaises(AssertionError):b.validate(c)
    def test_reused_body_cannot_be_redated_as_a_new_read(self):
        c=copy.deepcopy(self.c);e=next(e for e in c['academicEntryFollowups']if e['url']=='http://www.polyu.edu.hk/ama/');r=next(r for r in e['nextEntries']if r['bodyStatus']=='body_read');r['checkedAt']='2026-11-05'
        with self.assertRaisesRegex(AssertionError,'original verification date'):b.validate(c)
if __name__=='__main__':unittest.main()
