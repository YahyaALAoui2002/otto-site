// Otto — builds the translated pages and the language menu.
//   node tools/i18n/build.js
// 1. For each language in tools/i18n/langs/<code>.js, copies en/*.html into
//    <code>/*.html with every string swapped for its translation.
// 2. Rewrites the language menu (header + footer) and the hreflang links on
//    every page, French and English included.
// The English pages are the source: edit them (and the dictionaries), then re-run.

const fs = require('fs');
const path = require('path');
const { ROOT, PAGES, transform, norm } = require('./lib');

const SITE = 'https://yahyaalaoui2002.github.io/otto-site/';
const LANGS = [
  { code: 'fr', dir: '', name: 'Français' },
  { code: 'en', dir: 'en/', name: 'English' },
  { code: 'it', dir: 'it/', name: 'Italiano' },
  { code: 'es', dir: 'es/', name: 'Español' },
  { code: 'de', dir: 'de/', name: 'Deutsch' },
  { code: 'pl', dir: 'pl/', name: 'Polski' },
  { code: 'zh', dir: 'zh/', name: '中文' },
  { code: 'ru', dir: 'ru/', name: 'Русский' },
  { code: 'ja', dir: 'ja/', name: '日本語' },
  { code: 'el', dir: 'el/', name: 'Ελληνικά' },
];
const MENU_LABEL = { fr: 'Langue', en: 'Language' };
const SEP = { fr: ' : ', zh: '：', ja: '：' };
const MENU = /<details class="lang-menu">[\s\S]*?<\/details>/;
const LIST = /<ul class="lang-list"[\s\S]*?<\/ul>/;

// Path from a page in `from` to `page` in language `to`.
const href = (from, to, page) => (from.dir ? '../' : '') + to.dir + page;
const pageUrl = (lang, page) => SITE + lang.dir + (page === 'index.html' ? '' : page);
const link = (cur, l, page) => `<a href="${href(cur, l, page)}" hreflang="${l.code}" lang="${l.code}"${l === cur ? ' aria-current="true"' : ''}>`;

// Header dropdown (inside .nav-right).
function langMenu(cur, page, label) {
  const items = LANGS.map((l) => `          <li>${link(cur, l, page)}<span class="lang-menu-name">${l.name}</span><span class="lang-menu-code">${l.code.toUpperCase()}</span></a></li>`);
  return `<details class="lang-menu">
        <summary class="lang-menu-btn" aria-label="${label}${SEP[cur.code] || ': '}${cur.name}">
          <svg class="lang-menu-globe" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.4 2.6 3.6 5.6 3.6 9s-1.2 6.4-3.6 9c-2.4-2.6-3.6-5.6-3.6-9S9.6 5.6 12 3z"/></svg>
          <span class="lang-menu-current">${cur.code.toUpperCase()}</span>
          <svg class="lang-menu-chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5"/></svg>
        </summary>
        <ul class="lang-menu-list">
${items.join('\n')}
        </ul>
      </details>`;
}

// Footer list.
function langList(cur, page, label) {
  const items = LANGS.map((l) => `          <li>${link(cur, l, page)}${l.name}</a></li>`);
  return `<ul class="lang-list" aria-label="${label}">
${items.join('\n')}
        </ul>`;
}

function withLanguageMenus(html, cur, page, label) {
  if (!MENU.test(html) || !LIST.test(html)) throw new Error(`${cur.code}/${page}: language menu markup not found`);
  const alternates = [...LANGS, { ...LANGS[0], code: 'x-default' }]
    .map((l) => `<link rel="alternate" hreflang="${l.code}" href="${pageUrl(l, page)}">\n`).join('');
  return html
    .replace(/<link rel="alternate" hreflang[^>]*>\n/g, '')
    .replace('<link rel="stylesheet"', alternates + '<link rel="stylesheet"')
    .replace(LIST, langList(cur, page, label))
    .replace(MENU, langMenu(cur, page, label));
}

function translatePage(html, dict, lang, page, missing) {
  // The language menus are rebuilt afterwards; empty them so they aren't translated.
  html = html.replace(LIST, '<ul class="lang-list"></ul>').replace(MENU, '<details class="lang-menu"></details>');
  const tr = (raw) => {
    const key = norm(raw);
    let out = dict.strings[key] ?? dict.strings[key.replace(/’/g, "'")];
    if (out === undefined) {
      for (const [re, fn] of dict.patterns) {
        const m = key.match(re);
        if (m) { out = fn(...m.slice(1).map((s) => dict.strings[s] ?? s)); break; }
      }
    }
    if (out === undefined) {
      if (!KEEP.includes(key)) missing.add(key);
      return raw;
    }
    if (/[<>"]|&(?![a-z]+;|#\d+;)/.test(out)) throw new Error(`${lang.code}: unescaped HTML in translation of "${key}": ${out}`);
    const [, lead, , trail] = raw.match(/^(\s*)([\s\S]*?)(\s*)$/);
    return lead + out + trail;
  };
  // Prices: "€12" in the English source, "12 €" in most other languages.
  const price = dict.price || ((n) => `${n} €`);
  return transform(html, { onText: tr, onAttr: (a, v) => tr(v) })
    .replace(/€(\d+(?:\.\d+)?)/g, (m, n) => price(n))
    .replace('<html lang="en">', `<html lang="${lang.code}">`);
}

const KEEP = require('./langs/_keep');
let failed = false;
for (const lang of LANGS) {
  const generated = lang.code !== 'fr' && lang.code !== 'en';
  const dict = generated ? require(`./langs/${lang.code}`) : null;
  const missing = new Set();
  if (generated) fs.mkdirSync(path.join(ROOT, lang.dir), { recursive: true });
  for (const page of PAGES) {
    let html = fs.readFileSync(path.join(ROOT, generated ? 'en' : lang.dir, page), 'utf8');
    if (generated) html = translatePage(html, dict, lang, page, missing);
    html = withLanguageMenus(html, lang, page, dict ? dict.menuLabel : MENU_LABEL[lang.code]);
    fs.writeFileSync(path.join(ROOT, lang.dir, page), html);
  }
  if (missing.size) {
    failed = true;
    console.error(`${lang.code}: ${missing.size} untranslated string(s):\n  ` + [...missing].join('\n  '));
  } else {
    console.log(`${lang.code}: ok`);
  }
}
process.exitCode = failed ? 1 : 0;
