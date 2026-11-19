(function () {
  'use strict';
  const base = /* CATALOG_BASE */;
  const manifest = /* CATALOG_MANIFEST */;
  const scriptRoot = new URL('.', document.currentScript.src);
  const fields = ['faculty', 'directories', 'academicCoverage', 'sources'];
  const records = Object.fromEntries(fields.map(field => [field, new Map(field === 'sources' ? base.sources : [])]));
  const loaded = new Set(), pending = new Map();
  window.APP_CATALOG_PARTS = [];
  function publish() {
    for (const field of fields) base[field] = [...records[field]].sort((a,b) => a[0]-b[0]).map(row => row[1]);
    window.APP_ALL_SCHOOLS_READY = loaded.size === manifest.length;
  }
  publish();
  function load(key) {
    if (loaded.has(key)) return Promise.resolve(base);
    if (pending.has(key)) return pending.get(key);
    const part = manifest.find(row => row.key === key);
    if (!part) return Promise.reject(new Error('学校资料入口不存在。'));
    const request = new Promise((resolve,reject) => {
      const script = document.createElement('script');
      const timer = setTimeout(() => finish(new Error('资料下载超时，请重试。')),180000);
      function finish(error) {
        clearTimeout(timer);script.onload = script.onerror = null;
        if (!error) {
          const payload = window.APP_CATALOG_PARTS.find(row => row.key === key && row.snapshotId === base.snapshotId);
          if (!payload || fields.some(field => !Array.isArray(payload.records?.[field]))) error = new Error('学校资料版本不一致，请刷新后重试。');
          else if (fields.some(field => payload.records[field].some(row => !Number.isInteger(row[0]) || row[0]<0 || !row[1] ||
              (records[field].has(row[0]) && JSON.stringify(records[field].get(row[0])) !== JSON.stringify(row[1]))))) {
            error = new Error('学校资料不完整，请重试。');
          } else {
            fields.forEach(field => payload.records[field].forEach(row => records[field].set(row[0],row[1])));
            loaded.add(key);publish();
          }
        }
        pending.delete(key);
        if (error) { script.remove?.(); reject(error); } else resolve(base);
      }
      script.src = new URL(part.url,scriptRoot).href;script.async = true;
      script.onload = () => finish();
      script.onerror = () => finish(new Error('部分学校资料未能下载，请重试。'));
      document.head.append(script);
    });
    pending.set(key,request);return request;
  }
  window.APP_LOADED_SCHOOLS = loaded;
  window.APP_LOAD_SCHOOLS = keys => Promise.all([...new Set(keys)].map(load)).then(() => base);
  window.APP_LOAD_ALL = () => window.APP_LOAD_SCHOOLS(manifest.map(row => row.key));
  async function prepareSavedRecords() {
    let raw;
    try { raw = localStorage.getItem('yanxiang-local-v1'); } catch (_) {}
    if (!raw || raw.length > 1024*1024) return;
    let saved;
    try { saved = JSON.parse(raw); } catch (_) { return; }
    if (!saved || !Array.isArray(saved.shortlist) || !Array.isArray(saved.tasks) || !Array.isArray(saved.sourceIds)) return;
    const ids = [...saved.shortlist,...saved.tasks.map(task => task?.facultyId).filter(Boolean)];
    const schoolsById = new Map((window.APP_FACULTY_INDEX?.faculty || []).map(row => [row[4],row[1]]));
    // Unknown/older IDs must reach the existing full-catalogue validator. Never
    // discard an unresolved record merely to make startup appear successful.
    if (ids.some(id => !schoolsById.has(id))) { await window.APP_LOAD_ALL();return; }
    await window.APP_LOAD_SCHOOLS(ids.map(id => schoolsById.get(id)));
    const available = new Set(base.sources.map(source => source.id));
    if (saved.sourceIds.some(id => !available.has(id))) await window.APP_LOAD_ALL();
  }
  window.APP_CATALOG_READY = prepareSavedRecords().then(() => {
    window.APP_CATALOG = base;return base;
  });
  window.APP_CATALOG_READY.catch(() => {});
}());
