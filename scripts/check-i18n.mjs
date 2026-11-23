// Κάθε ελληνικό κείμενο του κώδικα (t('…'), tn(n, '…', '…'), ετικέτες κατηγοριών και ομάδων) πρέπει να έχει μετάφραση
// στο λεξικό ΚΑΘΕ γλώσσας του καταλόγου (src/i18n/languages.ts → src/i18n/<code>.ts), και κανένα λεξικό να μην έχει
// κλειδιά που δεν χρησιμοποιούνται ή {μεταβλητές} διαφορετικές από το ελληνικό. `--list <code>`: τυπώνει όσα λείπουν.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const walk = (d) => readdirSync(d).flatMap((f) => { const p = path.join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : []; });
const str = String.raw`'((?:[^'\\]|\\.)*)'`;
const keys = new Set();
for (const file of walk('src')) {
  if (file.includes(path.join('src', 'i18n') + path.sep)) continue; // τα λεξικά και ο πυρήνας
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(new RegExp(String.raw`\bt\(\s*${str}`, 'g'))) keys.add(m[1]);
  for (const m of src.matchAll(new RegExp(String.raw`\btn\([^,]+,\s*${str}\s*,\s*${str}`, 'g'))) { keys.add(m[1]); keys.add(m[2]); }
  if (file.endsWith('categories.ts')) for (const m of src.matchAll(new RegExp(String.raw`label:\s*${str}`, 'g'))) keys.add(m[1]);
  // ετικέτες ομάδων (domain/groups: GROUP_LABELS, μία ανά γραμμή «id: 'κείμενο',»)
  if (file.endsWith('groups.ts')) for (const m of src.matchAll(new RegExp(String.raw`^\s+\w+:\s*${str},?$`, 'gm'))) keys.add(m[1]);
}
const langs = [...readFileSync('src/i18n/languages.ts', 'utf8').match(/LANGS = \[([^\]]+)\]/)[1].matchAll(/'(\w+)'/g)].map((m) => m[1]).filter((l) => l !== 'el');
const vars = (x) => [...x.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const listFor = process.argv.includes('--list') ? process.argv[process.argv.indexOf('--list') + 1] : null;
let failed = false;
for (const lang of langs) {
  const src = readFileSync(`src/i18n/${lang}.ts`, 'utf8');
  // «'κλειδί': 'τιμή'» — η τιμή μπορεί να είναι στην επόμενη γραμμή
  const pairs = new Map([...src.matchAll(new RegExp(String.raw`^\s*${str}\s*:\s*\n?\s*${str}`, 'gm'))].map((m) => [m[1], m[2]]));
  const missing = [...keys].filter((k) => !pairs.has(k));
  const unused = [...pairs.keys()].filter((k) => !keys.has(k));
  const badVars = [...pairs].filter(([k, v]) => keys.has(k) && vars(k) !== vars(v)).map(([k]) => k);
  if (listFor === lang) { for (const k of missing) console.log(k); continue; }
  if (listFor) continue;
  console.log(`i18n ${lang}: ${keys.size} κείμενα, ${missing.length} χωρίς μετάφραση, ${unused.length} αχρησιμοποίητα, ${badVars.length} με λάθος {μεταβλητές}`);
  for (const k of unused) console.error(`  ${lang} αχρησιμοποίητο:`, k);
  for (const k of missing) console.error(`  ${lang} λείπει:`, k);
  for (const k of badVars) console.error(`  ${lang} {μεταβλητές}:`, k);
  if (missing.length || unused.length || badVars.length) failed = true;
}
if (failed) process.exit(1);
