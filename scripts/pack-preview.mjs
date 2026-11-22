// Φτιάχνει τη σελίδα του Artifact από το build προεπισκόπησης: μόνο το περιεχόμενο του body (τον σκελετό τον βάζει ο host).
import { readFileSync, writeFileSync, readdirSync, statSync, rmSync, renameSync } from 'node:fs';
import path from 'node:path';
const [dist, appDir] = process.argv.slice(2);
const html = readFileSync(path.join(dist, 'index.html'), 'utf8');
const js = /src="\.\/(assets\/[^"]+\.js)"/.exec(html)[1];
const css = /href="\.\/(assets\/[^"]+\.css)"/.exec(html)[1];
const theme = readFileSync(path.join(appDir, 'src/theme.css'), 'utf8');
const page = `<title>Βιβλιοθήκη εγχειριδίων</title>
<style>
${theme}
body { background: var(--bg); color: var(--ink); font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; }
.boot { min-height: 60vh; display: flex; align-items: center; justify-content: center; color: var(--ink-3); font-size: 15px; }
</style>
<link rel="stylesheet" href="${css}">
<div id="root"><p class="boot">Φόρτωση…</p></div>
<script type="module" src="${js}"></script>
`;
writeFileSync(path.join(dist, '..', 'manuals-preview.html'), page);
for (const f of ['index.html', 'manifest.webmanifest', 'icon.svg']) rmSync(path.join(dist, f), { force: true });
// ο host δεν σερβίρει δυαδικά δεδομένα (.gz): τα δεδομένα γλώσσας του OCR πάνε ως κείμενο base64
for (const l of ['ell', 'eng']) {
  const gz = path.join(dist, 'ocr/lang', `${l}.traineddata.gz`);
  writeFileSync(`${gz}.b64.txt`, readFileSync(gz).toString('base64'));
  rmSync(gz);
}
// …και ο worker του OCR τα ζητά μέσω ενός μικρού προσαρμογέα: ίδιο όνομα αρχείου, το fetch των .traineddata.gz διαβάζει
// το αντίστοιχο .b64.txt και επιστρέφει τα bytes. Ο κώδικας της εφαρμογής δεν αλλάζει.
renameSync(path.join(dist, 'ocr/worker.min.js'), path.join(dist, 'ocr/tesseract-worker.js'));
writeFileSync(path.join(dist, 'ocr/worker.min.js'), `const realFetch = self.fetch.bind(self);
self.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  if (!/\\.traineddata\\.gz$/.test(url)) return realFetch(input, init);
  const r = await realFetch(url + '.b64.txt');
  if (!r.ok) return r;
  const bin = atob((await r.text()).trim());
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Response(bytes, { status: 200 });
};
importScripts(new URL('tesseract-worker.js', self.location.href).href);
`);
const walk = (d) => readdirSync(d).flatMap((f) => { const p = path.join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(dist).map((p) => ({ path: path.relative(dist, p), size: statSync(p).size }));
writeFileSync(path.join(dist, '..', 'preview-files.json'), JSON.stringify(files, null, 1));
console.log(files.map((f) => `${String(f.size).padStart(9)}  ${f.path}`).join('\n'));
// τοπική δοκιμή: η ίδια σελίδα μέσα σε σκελετό όπως του host
writeFileSync(path.join(dist, 'local-test.html'), `<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>${page}</body></html>`);
