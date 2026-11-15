const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../data/catalog.json');
const L = require('../dist/logic.js');

test('Duan research and undated PhD statement keep the existing identity and separate admission scope', () => {
  const faculty = C.faculty.find(f => f.id === 'cuhksz-sse-duanjunming');
  assert.equal(faculty.profileUrl, 'https://myweb.cuhk.edu.cn/duanjunming');
  assert.equal(faculty.availability.state, 'unknown');
  assert.equal(faculty.availability.cycle, null);
  assert.ok(faculty.researchKeywords.includes('熵稳定方法'));
  const links = L.facultyLinks(C, faculty);
  assert.ok(links.some(l => l.url === 'https://junmingduan.github.io/openings/' && l.bodyStatus === 'body_read'));
  const note = faculty.applicationNotes.find(n => n.sourceIds.includes('cuhksz-sse-duan-openings-20261115'));
  assert.deepEqual(note.degrees, ['PhD']);
  assert.match(note.text, /未注明招生年度/);
  assert.ok(!note.mentionedIntakes);
  const home = C.sources.find(s => s.id === 'cuhksz-sse-duan-home-20261115');
  assert.equal(home.checkedAt, '2026-11-15');
  assert.equal(home.parentSourceId, 'cuhksz-sse-roles-20261111-duanjunming');
});
