'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),C=require('../data/catalog.json'),L=require('../dist/logic.js');
const profile=query=>({...L.defaultProfile(C),universityIds:['polyu'],researchQuery:query});
test('Chinese food and nutrition searches find sourced research terms without matching unrelated summaries',()=>{
 const food=L.facultyFor(C,profile('食品安全')).map(f=>f.id);
 for(const id of ['polyu-fsn-prof-wong-mankin','polyu-fsn-prof-xia-xiaodong','polyu-fsn-dr-zhang-fang'])assert.ok(food.includes(id));
 assert.ok(!food.includes('polyu-fsn-prof-lo-kahei-kenneth'));
 assert.ok(L.facultyFor(C,profile('肠道菌群')).some(f=>f.id==='polyu-fsn-prof-chiou-jiachi-amber'));
 assert.ok(L.facultyFor(C,profile('营养流行病学')).some(f=>f.id==='polyu-fsn-dr-hui-lailing-connie'));
 assert.ok(L.facultyFor(C,profile('微塑料')).some(f=>f.id==='polyu-fsn-prof-fang-karhei-james'));
 const synthetic={name:'Test person',researchKeywords:['Food Safety'],summary:'Gut Microbiome'};
 assert.equal(L.facultySearch('肠道菌群').matchedTerms(synthetic).length,0);
});
test('probiotics, prebiotics and synbiotics remain distinct research terms',()=>{
 const pairs=[['益生菌','Probiotics'],['益生元','Prebiotics'],['合生元','Synbiotics']];
 for(const [query,term] of pairs)for(const [,candidate] of pairs){assert.equal(L.facultySearch(query).matchedTerms({researchKeywords:[candidate]}).length,term===candidate?1:0);}
});
test('search and external lab evidence preserve the official identity and unknown recruitment',()=>{
 const f=C.faculty.find(f=>f.id==='polyu-fsn-dr-zhang-fang');assert.equal(f.directoryRole,'Research Assistant Professor');assert.equal(f.availability.state,'unknown');
 const note=f.applicationNotes.find(n=>n.kind==='page_conflict');assert.match(note.text,/福州大学/);assert.ok(note.sourceIds.includes('polyu-fsn-dr-zhang-fang-20261119'));
 const snapshot=JSON.stringify(C);L.facultyFor(C,profile('细菌耐药'));assert.equal(JSON.stringify(C),snapshot);
});
