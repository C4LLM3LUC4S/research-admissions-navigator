import copy, importlib.util, unittest
from pathlib import Path
spec = importlib.util.spec_from_file_location('science_queue_builder', Path(__file__).resolve().parents[1]/'scripts/build_catalog.py')
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)

class ScienceQueueBoundaries(unittest.TestCase):
    @classmethod
    def setUpClass(cls): cls.catalog = b.build_catalog()

    def test_name_cannot_be_assigned_another_known_group_site(self):
        c = copy.deepcopy(self.catalog)
        d = next(d for d in c['directories'] if d['id']=='hku-science-chemistry-observed-staff')
        rows = [e for e in d['census']['unlinkedEntries'] if e['providedLinks']]
        rows[0]['providedLinks'] = rows[1]['providedLinks']
        with self.assertRaisesRegex(AssertionError, 'own observed identity'): b.validate(c)

    def test_math_refresh_cannot_jump_to_another_existing_official_url(self):
        c = copy.deepcopy(self.catalog)
        m = next(e for e in c['academicEntryFollowups'] if e['url']=='http://www.math.hku.hk/')
        m['unitNavigationChain'][0]['declaredTarget']='https://chemistry.hku.hk/'
        with self.assertRaisesRegex(AssertionError, 'actual declared target'): b.validate(c)

    def test_read_staff_page_cannot_borrow_another_unit_source(self):
        c = copy.deepcopy(self.catalog)
        e = next(e for e in c['academicEntryFollowups'] if e['url']=='http://www.biosch.hku.hk/')
        e['nextEntries'][0]['sourceIds']=['hku-science-chemistry-staff-20261105']
        with self.assertRaises(AssertionError): b.validate(c)

    def test_embedded_redirect_failure_cannot_claim_names(self):
        c = copy.deepcopy(self.catalog)
        m = next(e for e in c['academicEntryFollowups'] if e['url']=='http://www.math.hku.hk/')
        m['nextEntries'][0]['embeddedRead']['namesRead']=1
        with self.assertRaises(AssertionError): b.validate(c)

if __name__=='__main__': unittest.main()
