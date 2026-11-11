const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const canonical = require('../data/catalog.json');
const logic = require('../dist/logic.js');

const context = {window: {}};
const script = fs.readFileSync(path.join(__dirname, '../dist/catalog.js'), 'utf8');
vm.runInNewContext(script, context);
const browser = JSON.parse(JSON.stringify(context.window.APP_CATALOG));

test('browser data keeps application records and the canonical snapshot identity', () => {
  const {sources: canonicalSources, ...canonicalRecords} = canonical;
  const {sources: browserSources, ...browserRecords} = browser;
  assert.deepEqual(browserRecords, canonicalRecords);
  assert.equal(browserSources.length, canonicalSources.length);
  for (const [index, source] of canonicalSources.entries()) {
    const {discoveredLinks = [], ...record} = source;
    const {discoveredLinks: transferred = [], ...browserRecord} = browserSources[index];
    assert.deepEqual(browserRecord, record);
    assert.ok(transferred.every(url => discoveredLinks.includes(url)));
    assert.equal(logic.sourceUrl(browser, browserSources[index]), logic.sourceUrl(canonical, source));
  }
});

test('browser data keeps profile and provided links as displayed in each directory', () => {
  function check(url, sources) {
    assert.equal(logic.observedProfileUrl(browser, url, sources), logic.observedProfileUrl(canonical, url, sources), url);
  }
  for (const faculty of canonical.faculty) {
    check(faculty.profileUrl, faculty.directorySourceIds);
    assert.deepEqual(logic.facultyLinks(browser, faculty), logic.facultyLinks(canonical, faculty), faculty.id);
  }
  for (const directory of canonical.directories) {
    for (const entry of directory.census?.entries || []) check(entry.profileUrl, directory.sourceIds);
    for (const entry of directory.census?.unlinkedEntries || []) {
      for (const link of entry.providedLinks || []) check(link.url, directory.sourceIds);
    }
  }
  for (const school of canonical.academicCoverage) {
    for (const unit of school.units) {
      for (const entry of unit.staffEntries || []) {
        for (const lead of entry.profileLeads || []) {
          check(lead.url, entry.sourceIds);
          for (const pageId of entry.pageSourceIds || []) check(lead.url, [pageId]);
        }
      }
    }
  }
});
