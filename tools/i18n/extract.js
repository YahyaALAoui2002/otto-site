// Lists every translatable English string, in page order, as a JSON skeleton.
// Usage: node tools/i18n/extract.js > strings.json

const fs = require('fs');
const path = require('path');
const { ROOT, PAGES, transform, norm } = require('./lib');

const seen = new Map();
for (const page of PAGES) {
  const html = fs.readFileSync(path.join(ROOT, 'en', page), 'utf8');
  const add = (s) => { const k = norm(s); if (!seen.has(k)) seen.set(k, page); return s; };
  transform(html, { onText: add, onAttr: (a, v) => add(v) });
}
process.stdout.write(JSON.stringify([...seen.keys()], null, 0).replace(/","/g, '",\n"') + '\n');
