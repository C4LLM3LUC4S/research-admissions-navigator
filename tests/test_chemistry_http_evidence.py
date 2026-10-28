"""Recorded evidence does not authorize a protocol change or a clickable HTTP link."""
import importlib.util
import unittest
from pathlib import Path

spec=importlib.util.spec_from_file_location('chemistry_builder',Path(__file__).resolve().parents[1]/'scripts/build_catalog.py')
builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)

class ChemistryRedirectEvidence(unittest.TestCase):
    def record(self):
        catalog=builder.build_catalog()
        person=next(f for f in catalog['faculty'] if f['id']=='hkust-chemistry-23')
        link=person['extraLinks'][0]
        source=next(s for s in catalog['sources'] if s['id']==link['sourceId'])
        return catalog,link,source

    def test_actual_trailing_slash_redirect_is_retained_as_read_only_http(self):
        catalog,link,source=self.record()
        self.assertEqual(link['url'],'http://www.boroncatal.com/people')
        self.assertEqual(source['url'],'http://www.boroncatal.com/people/')
        self.assertEqual(source['transportScope'],'read_only_http_source_not_clickable')
        builder.validate(catalog)

    def test_original_address_cannot_be_guessed_or_reassigned(self):
        catalog,link,source=self.record()
        source['originalUrl']='http://www.boroncatal.com/other-person'
        with self.assertRaises(AssertionError):builder.validate(catalog)

    def test_https_origin_cannot_authorize_an_http_downgrade(self):
        catalog,link,source=self.record()
        parent=next(s for s in catalog['sources'] if s['id']==link['parentSourceId'])
        link['url']='https://www.boroncatal.com/people'
        source['originalUrl']=link['url']
        parent['discoveredLinks'].append(link['url'])
        with self.assertRaises(AssertionError):builder.validate(catalog)

if __name__=='__main__':unittest.main()
