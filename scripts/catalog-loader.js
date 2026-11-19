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
  // Validate existing portable records only after the complete ID set is ready.
  let saved = false;
  try { saved = !!localStorage.getItem('yanxiang-local-v1'); } catch (_) {}
  window.APP_CATALOG_READY = (saved ? window.APP_LOAD_ALL() : Promise.resolve(base)).then(() => {
    window.APP_CATALOG = base;return base;
  });
  window.APP_CATALOG_READY.catch(() => {});
}());
