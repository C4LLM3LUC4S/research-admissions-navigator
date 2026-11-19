(function () {
  'use strict';
  const base = /* CATALOG_BASE */;
  const manifest = /* CATALOG_MANIFEST */;
  const scriptRoot = new URL('.', document.currentScript.src);
  window.APP_CATALOG_PARTS = [];
  window.APP_CATALOG_READY = Promise.all(manifest.map(part => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => finish(new Error('资料下载超时，请重试。')), 180000);
    function finish(error) {
      clearTimeout(timer);
      script.onload = script.onerror = null;
      if (error) reject(error);
      else resolve();
    }
    script.src = new URL(part.url, scriptRoot).href;
    script.async = true;
    script.onload = () => finish();
    script.onerror = () => finish(new Error('部分学校资料未能下载，请重试。'));
    document.head.append(script);
  }))).then(() => {
    const parts = window.APP_CATALOG_PARTS;
    if (parts.length !== manifest.length || new Set(parts.map(part => part.key)).size !== manifest.length ||
        parts.some(part => part.snapshotId !== base.snapshotId || !manifest.some(row => row.key === part.key))) {
      throw new Error('学校资料版本不一致，请刷新后重试。');
    }
    for (const field of ['faculty', 'directories', 'academicCoverage', 'sources']) {
      const rows = parts.flatMap(part => part.records[field]).sort((a, b) => a[0] - b[0]);
      if (rows.some((row, index) => row[0] !== index)) throw new Error('学校资料不完整，请重试。');
      base[field] = rows.map(row => row[1]);
    }
    window.APP_CATALOG = base;
    delete window.APP_CATALOG_PARTS;
    return base;
  });
  // The application attaches its own failure display after this deferred script.
  window.APP_CATALOG_READY.catch(() => {});
}());
