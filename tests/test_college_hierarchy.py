"""Reject corrupted parent/source/type bindings, without re-fetching official sources."""
import copy
import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('hierarchy_builder',Path(__file__).resolve().parents[1]/'scripts/build_catalog.py')
builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)

class HierarchyChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog=builder.build_catalog()

    def test_nested_group_cannot_borrow_a_different_parent_or_have_no_parent(self):
        for parent in ['Invented School',None]:
            catalog=copy.deepcopy(self.catalog)
            group=next(g for m in catalog['academicCoverage']for u in m['units']for g in u.get('relatedNavigationGroups',[])if g['kind']=='academic_subunits')
            group['parentUnitName']=parent
            with self.assertRaisesRegex(AssertionError,'actual listed parent'):
                builder.validate(catalog)

    def test_new_list_name_and_url_cannot_be_guessed_from_old_read_receipt(self):
        for field,value in [('name','Unprovided department'),('url','https://not-provided.example/')]:
            catalog=copy.deepcopy(self.catalog)
            child=next(c for m in catalog['academicCoverage']for u in m['units']for c in u['children']if c.get('inventoryListing'))
            child['inventoryListing'][field]=value
            with self.assertRaisesRegex(AssertionError,'parent evidence'):
                builder.validate(catalog)

    def test_another_existing_school_cannot_borrow_nested_source(self):
        catalog=copy.deepcopy(self.catalog)
        college=next(u for m in catalog['academicCoverage']for u in m['units']if u['id']=='hku-8')
        college['relatedNavigationGroups'][0]['parentUnitName']='School of Nursing'
        with self.assertRaisesRegex(AssertionError,'belong to this actual parent'):
            builder.validate(catalog)

    def test_nested_navigation_cannot_become_a_degree_route_or_claim_availability(self):
        for field,value in [('kind','research_degree_navigation'),('availability','available'),('entryBodyStatus','body_read')]:
            catalog=copy.deepcopy(self.catalog)
            group=next(g for m in catalog['academicCoverage']for u in m['units']for g in u.get('relatedNavigationGroups',[])if g['kind']=='academic_subunits')
            group['entries'][0][field]=value
            with self.assertRaises(AssertionError):
                builder.validate(catalog)

if __name__=='__main__':unittest.main()
