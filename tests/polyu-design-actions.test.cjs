'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const before = require('../data/snapshots/623d0f0013958c8b985ad78bb55a8b3c2e77ad835343a47ea50f12786ad28e42.json');
const after = require('../data/catalog.json');
const update = require('../data/research/polyu-design-application-20261107.json');

test('the School of Design application guidance keeps the 2027 route and every other applicant record', () => {
  const project = catalogue => catalogue.programs.find(p => p.id === update.programId);
  const preserved = ({ sourceIds, requirements, ...rest }) => rest;
  assert.deepEqual(preserved(project(after)), preserved(project(before)));
  assert.deepEqual(project(after).requirements.slice(2), project(before).requirements.slice(1));
  assert.deepEqual(after.programs.filter(p => p.id !== update.programId),
    before.programs.filter(p => p.id !== update.programId));
  assert.deepEqual(after.faculty, before.faculty);
  assert.deepEqual(after.directories, before.directories);
  assert.deepEqual(after.sources, [...before.sources, update.source]);
  const unit = catalogue => catalogue.academicCoverage.flatMap(school => school.units)
    .find(row => row.id === update.unitId);
  assert.deepEqual(unit(after).children, unit(before).children);
  assert.deepEqual(unit(after).staffEntries, unit(before).staffEntries);
  assert.equal(unit(after).organizationReview.organizationComplete, false);
});
