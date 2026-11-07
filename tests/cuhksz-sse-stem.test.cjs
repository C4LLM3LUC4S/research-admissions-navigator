'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const old = require('../data/snapshots/d2ac868c05949351cd5d7a8a261280bafa6458830af7de00e9b21a9dbbcdfd0d.json');
const current = require('../data/snapshots/0b6a10b999a977ee242890ca4def09ab655d206ab9bd0cbab60213945302f82c.json');
const pack = require('../data/research/cuhksz-sse-stem-20261107.json');
const role = catalogue => catalogue.academicCoverage.flatMap(school => school.units)
  .find(unit => unit.id === 'cuhksz-2').staffEntries[0];

test('reviewed SSE profiles link the applicant to official evidence and keep unknowns and saved IDs', () => {
  const byId = new Map(current.faculty.map(person => [person.id, person]));
  const sources = new Map(current.sources.map(source => [source.id, source]));
  const reviewed = role(current).profileLeads.filter(lead => lead.facultyId);
  assert.equal(reviewed.length, 17);
  assert.equal(role(current).profileLeads.length, role(old).profileLeads.length);
  for (const lead of reviewed) {
    const person = byId.get(lead.facultyId);
    assert.equal(person.reviewedProfileUrl || person.profileUrl, lead.url);
    assert.equal(person.availability.state, 'unknown');
    const evidence = person.keywordSourceIds.map(id => sources.get(id)).find(source => source.url === lead.url);
    assert.equal(evidence.bodySha256, lead.bodySha256);
    assert.equal(sources.get(evidence.parentSourceId).url, lead.observedOn);
  }
  const prior = old.faculty.find(person => person.id === 'wide-cuhksz-li-qiu');
  const existing = byId.get(prior.id);
  for (const field of ['profileUrl', 'availability', 'role', 'name']) assert.deepEqual(existing[field], prior[field]);
  assert.deepEqual(current.faculty.filter(person => person.id !== prior.id).slice(0, old.faculty.length - 1),
    old.faculty.filter(person => person.id !== prior.id));
  assert.deepEqual(current.programs, old.programs);
  assert.deepEqual(current.directories, old.directories);
  assert.equal(current.faculty.length, old.faculty.length + 16);
  assert.ok(pack.heldOut.every(item => !reviewed.some(lead => lead.url === item.url)));
});
