// Κάθε ελληνικό κείμενο του κώδικα (t('…'), tn(n, '…', '…'), ετικέτες κατηγοριών) πρέπει να έχει αγγλική μετάφραση στο
// src/i18n/en.ts, και το en.ts να μην έχει κλειδιά που δεν χρησιμοποιούνται. `--list`: τυπώνει όσα λείπουν.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const walk = (d) => readdirSync(d).flatMap((f) => { const p = path.join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(p) ? [p] : []; });
const str = String.raw`'((?:[^'\\]|\\.)*)'`;
const keys = new Set();
for (const file of walk('src')) {
  if (file.endsWith(path.join('i18n', 'en.ts'))) continue;
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(new RegExp(String.raw`\bt\(\s*${str}`, 'g'))) keys.add(m[1]);
  for (const m of src.matchAll(new RegExp(String.raw`\btn\([^,]+,\s*${str}\s*,\s*${str}`, 'g'))) { keys.add(m[1]); keys.add(m[2]); }
  if (file.endsWith('categories.ts')) for (const m of src.matchAll(new RegExp(String.raw`label:\s*${str}`, 'g'))) keys.add(m[1]);
  // ετικέτες ομάδων (domain/groups: GROUP_LABELS, μία ανά γραμμή «id: 'κείμενο',»)
  if (file.endsWith('groups.ts')) for (const m of src.matchAll(new RegExp(String.raw`^\s+\w+:\s*${str},?$`, 'gm'))) keys.add(m[1]);
}
const en = readFileSync('src/i18n/en.ts', 'utf8');
const have = new Set([...en.matchAll(new RegExp(String.raw`^\s*${str}\s*:`, 'gm'))].map((m) => m[1]));
const missing = [...keys].filter((k) => !have.has(k));
const unused = [...have].filter((k) => !keys.has(k));
if (process.argv.includes('--list')) for (const k of missing) console.log(k);
else console.log(`i18n: ${keys.size} κείμενα, ${missing.length} χωρίς μετάφραση, ${unused.length} αχρησιμοποίητα`);
for (const k of unused) console.error('αχρησιμοποίητο:', k);
if (!process.argv.includes('--list') && (missing.length || unused.length)) { for (const k of missing) console.error('λείπει:', k); process.exit(1); }
