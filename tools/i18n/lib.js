// Otto — i18n helpers shared by extract.js and build.js.
// The English pages (en/*.html) are the source; each other language is the
// same markup with its visible strings and translatable attributes swapped.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PAGES = ['index.html', 'la-carte.html', 'reservation.html', 'commander.html', 'photos.html', 'contact.html'];
const ATTRS = ['alt', 'aria-label', 'placeholder', 'title', 'data-label'];

// Strings with no letters (prices, times, phone numbers, symbols) never need translating.
const hasLetters = (s) => /\p{L}/u.test(s);
const norm = (s) => s.trim().replace(/\s+/g, ' ');

// Walk the HTML, calling onText(rawText) for text outside script/style/comments
// and onAttr(name, value) for translatable attributes; each returns the replacement.
function transform(html, { onText, onAttr }) {
  let out = '';
  let i = 0;
  while (i < html.length) {
    if (html.startsWith('<!--', i)) {
      const end = html.indexOf('-->', i) + 3;
      out += html.slice(i, end);
      i = end;
    } else if (html[i] === '<') {
      const end = html.indexOf('>', i) + 1;
      let tag = html.slice(i, end);
      const name = (tag.match(/^<\/?([a-zA-Z0-9-]+)/) || [])[1]?.toLowerCase();
      tag = tag.replace(/\s([a-z-]+)="([^"]*)"/g, (m, attr, val) => {
        const translatable = ATTRS.includes(attr) || (attr === 'content' && name === 'meta' && /name="description"/.test(tag));
        if (!translatable || !hasLetters(val)) return m;
        return ` ${attr}="${onAttr(attr, val)}"`;
      });
      out += tag;
      i = end;
      if ((name === 'script' || name === 'style') && !tag.startsWith('</')) {
        const close = html.indexOf(`</${name}`, i);
        out += html.slice(i, close);
        i = close;
      }
    } else {
      const next = html.indexOf('<', i);
      const end = next === -1 ? html.length : next;
      const text = html.slice(i, end);
      out += hasLetters(text) ? onText(text) : text;
      i = end;
    }
  }
  return out;
}

module.exports = { ROOT, PAGES, transform, norm, hasLetters };
