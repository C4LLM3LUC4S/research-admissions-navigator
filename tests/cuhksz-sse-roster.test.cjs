'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const old = require('../data/snapshots/e4a453db59df82eb73db85dc523a5a89ca91eba74598c3aa0a444deba853018c.json');
const current = require('../data/catalog.json');

test('SSE roster discovery leaves teacher identities, recruitment and programme decisions untouched', () => {
  const stripStaff = catalogue => catalogue.academicCoverage.map(school => ({
    ...school, units: school.units.map(unit => unit.id === 'cuhksz-2' ? { ...unit, staffEntries: [] } : unit),
  }));
  const unit = current.academicCoverage.flatMap(school => school.units).find(unit => unit.id === 'cuhksz-2');
  const [entry] = unit.staffEntries;
  assert.deepEqual(stripStaff(current), stripStaff(old));
  assert.deepEqual(current.faculty, old.faculty);
  assert.deepEqual(current.programs, old.programs);
  assert.deepEqual(current.sources.slice(0, old.sources.length), old.sources);
  assert.deepEqual(current.directories.slice(0, old.directories.length), old.directories);
  assert.equal(unit.staffEntries.length, 1);
  assert.equal(entry.enumerationComplete, false);
  assert.equal(entry.teacherProfilesTotal, null);
  assert.equal(entry.pageSourceIds.length, 18);
  assert.equal(new Set(entry.profileLeads.map(person => person.url)).size, 172);
  assert.ok(entry.profileLeads.every(person => person.supervisionEligibility === 'unknown'
    && person.availability === 'unknown' && !person.facultyId));
});
