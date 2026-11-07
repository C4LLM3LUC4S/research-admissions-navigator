'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const before = require('./fixtures/before-robotics.cjs');
const after = require('../data/snapshots/e4a453db59df82eb73db85dc523a5a89ca91eba74598c3aa0a444deba853018c.json');
const pack = require('../data/research/hkustgz-roas-census-20261107.json');

test('robotics evidence updates five saved identities and preserves every unrelated catalogue record', () => {
  const updates = new Map(pack.facultyUpdates.map(update => [update.id, update]));
  assert.equal(updates.size, 5);
  assert.equal(pack.faculty.length, 17);
  assert.equal(pack.directory.census.entries.length, 25);
  assert.equal(pack.directory.census.entries.filter(entry => !entry.facultyId).length, 3);
  assert.equal(pack.directory.coverageComplete, false);
  const reviewedFields = new Set(['sourceIds', 'directorySourceIds', 'keywordSourceIds', 'academicUnitIds',
    'researchKeywords', 'reviewedProfileUrl', 'directoryRole', 'identityNote', 'role', 'extraLinks']);
  const unchangedFields = person => Object.fromEntries(Object.entries(person).filter(([key]) => !reviewedFields.has(key)));
  before.faculty.forEach((person, index) => {
    const current = after.faculty[index];
    const update = updates.get(person.id);
    if (!update) {
      assert.deepEqual(current, person, person.id);
      return;
    }
    assert.deepEqual(unchangedFields(current), unchangedFields(person), person.id);
    assert.equal(current.universityId, 'hkustgz');
    assert.equal(current.reviewedProfileUrl, update.reviewedProfileUrl);
    assert.equal(current.directoryRole, update.directoryRole);
    for (const key of ['sourceIds', 'keywordSourceIds', 'directorySourceIds', 'researchKeywords']) {
      assert.ok([...(person[key] || []), ...update[key]].every(value => current[key].includes(value)), key);
    }
    assert.ok((person.extraLinks || []).every(link => current.extraLinks.some(currentLink => currentLink.url === link.url)));
  });
  assert.deepEqual(after.faculty.slice(before.faculty.length), pack.faculty);
  assert.deepEqual(after.sources, [...before.sources, ...pack.sources]);
  assert.deepEqual(after.directories, [...before.directories, pack.directory]);
  for (const key of Object.keys(before).filter(k => !['faculty', 'sources', 'directories', 'academicCoverage', 'snapshotId', 'checkedDate'].includes(k))) {
    assert.deepEqual(after[key], before[key], key);
  }
  const units = catalogue => catalogue.academicCoverage.flatMap(row => row.units).filter(unit => unit.id !== 'hkustgz-3');
  assert.deepEqual(units(after), units(before));
});
