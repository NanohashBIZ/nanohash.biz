// Adds the current release number (from /api/versions) to every download button, e.g. "Download free  v7.1.1".
(() => {
  const links = [...document.querySelectorAll('a[href^="/download/"]')];
  if (!links.length) return;
  const appOf = href => (/tidyup/i.test(href) ? 'tidyup' : /nanopdf/i.test(href) ? 'nanopdf' : /nanoshare/i.test(href) ? 'nanoshare' : null);
  fetch('/api/versions').then(r => (r.ok ? r.json() : null)).then(v => {
    if (!v) return;
    for (const a of links) {
      const info = v[appOf(a.getAttribute('href'))];
      if (!info?.version || a.querySelector('.nh-ver')) continue;
      const tag = document.createElement('span');
      tag.className = 'nh-ver';
      tag.textContent = `v${info.version}`;
      if (info.date) tag.title = info.date;
      a.append(tag);
    }
  }).catch(() => { /* no version label, the button still works */ });
})();
