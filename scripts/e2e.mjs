// Δοκιμή από άκρη σε άκρη στο build (dist), σε Chromium με διαστάσεις κινητού και iPad:
// σάρωση εξωφύλλου (OCR + QR) → αποθήκευση → κατέβασμα PDF → ανακύκλωση → εγγύηση → παραστατικό → αναζήτηση/φίλτρα →
// αντίγραφο ασφαλείας (εξαγωγή, εισαγωγή σε «άλλη συσκευή»). Αποτυγχάνει και σε οποιοδήποτε σφάλμα κονσόλας (π.χ. CSP).
// Χρήση: npm run build && npm run e2e   (χρειάζεται εγκατεστημένο το playwright με Chromium)
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import QRCode from 'qrcode';
import { createRequire } from 'node:module';
// require: βρίσκει το playwright και όταν είναι εγκατεστημένο καθολικά (NODE_PATH), όχι μόνο στο project
const { chromium } = createRequire(import.meta.url)('playwright');

const PORT = 4179;
const BASE = `http://localhost:${PORT}/`;
const OUT = path.resolve(process.env.E2E_OUT ?? '.e2e');
mkdirSync(OUT, { recursive: true });

const PDF_URL = 'https://example.com/manuals/WAU28PH9BY.pdf';
const VIDEO_URL = 'https://youtu.be/abc123xyz';
const PDF_BYTES = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');

const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
const stop = () => server.kill();
process.on('exit', stop);
for (let i = 0; i < 50; i++) { try { await fetch(BASE); break; } catch { await new Promise((r) => setTimeout(r, 200)); } }

const browser = await chromium.launch();
const errors = [];
const watch = (page) => {
  // διαγνωστικά που τυπώνει το ίδιο το Tesseract (όχι σφάλματα της εφαρμογής)
  const benign = /Parameter not found: language_model_ngram_on|Estimating resolution as/;
  page.on('console', (m) => { if (m.type() === 'error' && !benign.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });
};
const step = (name) => console.log(`• ${name}`);

/** Δοκιμαστικές εικόνες, ζωγραφισμένες σε canvas: εξώφυλλο εγχειριδίου με δύο QR, και απόδειξη με ημερομηνία. */
async function makeImages(page) {
  const [qrPdf, qrVideo] = await Promise.all([PDF_URL, VIDEO_URL].map((u) => QRCode.toDataURL(u, { margin: 2, width: 300 })));
  const draw = (fn, arg) => page.evaluate(fn, arg).then((d) => Buffer.from(d.split(',')[1], 'base64'));
  const cover = await draw(async ({ qrPdf, qrVideo }) => {
    const c = document.createElement('canvas');
    c.width = 1200; c.height = 1600;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 1200, 1600);
    x.fillStyle = '#111';
    x.font = 'bold 150px Arial'; x.fillText('BOSCH', 90, 240);
    x.font = '64px Arial'; x.fillText('Πλυντήριο ρούχων', 90, 400); x.fillText('Εγχειρίδιο χρήσης', 90, 490);
    x.font = '56px Arial'; x.fillText('Μοντέλο: WAU28PH9BY', 90, 640);
    x.font = '40px Arial'; x.fillText('220-240V 50Hz   EN60335', 90, 740);
    const img = (src, px, py) => new Promise((res) => { const i = new Image(); i.onload = () => { x.drawImage(i, px, py, 360, 360); res(); }; i.src = src; });
    await img(qrPdf, 90, 1050); await img(qrVideo, 700, 1050);
    return c.toDataURL('image/png');
  }, { qrPdf, qrVideo });
  const receipt = await draw(() => {
    const c = document.createElement('canvas');
    c.width = 800; c.height = 1000;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, 800, 1000);
    x.fillStyle = '#111'; x.font = '48px Arial';
    ['ΑΠΟΔΕΙΞΗ ΛΙΑΝΙΚΗΣ', '14/03/2025  12:41', 'WAU28PH9BY   499,00', 'ΣΥΝΟΛΟ   499,00'].forEach((s, i) => x.fillText(s, 60, 150 + i * 110));
    return c.toDataURL('image/png');
  });
  writeFileSync(path.join(OUT, 'test-cover.png'), cover);
  writeFileSync(path.join(OUT, 'test-receipt.png'), receipt);
  return { cover: path.join(OUT, 'test-cover.png'), receipt: path.join(OUT, 'test-receipt.png') };
}

try {
  // ---------- κινητό ----------
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, locale: 'el-GR', acceptDownloads: true });
  await phone.route(PDF_URL, (r) => r.fulfill({ status: 200, contentType: 'application/pdf', headers: { 'access-control-allow-origin': '*' }, body: PDF_BYTES }));
  const page = await phone.newPage();
  watch(page);
  await page.goto(BASE);
  const shot = (name, p = page) => p.screenshot({ path: path.join(OUT, `${name}.png`) });

  step('κενή βιβλιοθήκη');
  await page.getByRole('heading', { name: 'Ξεκίνα με το πρώτο σου έντυπο' }).waitFor();
  await shot('01-empty');
  const files = await makeImages(page);

  step('σάρωση εξωφύλλου (OCR + QR)');
  await page.getByRole('link', { name: 'Σάρωση εντύπου' }).first().click();
  await shot('02-scan-start');
  await page.locator('label:has-text("Από τις φωτογραφίες") input[type=file]').setInputFiles(files.cover);
  await page.getByText('Διαβάζω το κείμενο').waitFor();
  await shot('03-scan-working');
  await page.getByRole('heading', { name: 'Τι βρήκαμε' }).waitFor({ timeout: 120_000 });
  assert.equal(await page.locator('#sc-brand').inputValue(), 'Bosch');
  // το OCR μπορεί να μπερδέψει έναν χαρακτήρα του κωδικού (π.χ. 9 ↔ I): ο χρήστης τον διορθώνει, όπως εδώ
  assert.match(await page.locator('#sc-model').inputValue(), /^WAU28PH.BY$/);
  await page.locator('#sc-model').fill('WAU28PH9BY');
  assert.equal(await page.locator('#sc-cat').inputValue(), 'laundry');
  await page.getByText('Έγγραφο PDF').waitFor();
  await page.getByText('youtu.be').waitFor();
  await shot('04-scan-review');
  await page.screenshot({ path: path.join(OUT, '04b-scan-review-full.png'), fullPage: true });

  step('αποθήκευση → εύρεση ψηφιακού → κατέβασμα PDF από το QR');
  await page.getByRole('button', { name: 'Αποθήκευση και εύρεση ψηφιακού' }).click();
  await page.getByRole('heading', { name: 'Βρες το ψηφιακό' }).waitFor();
  await page.waitForTimeout(400);
  await shot('05-find-manual');
  await page.getByRole('button', { name: 'Κατέβασμα' }).first().click();
  await page.getByRole('heading', { name: 'Το ψηφιακό αποθηκεύτηκε' }).waitFor();
  await page.waitForTimeout(400);
  await shot('06-saved');
  await page.getByRole('dialog').getByRole('button', { name: 'Το ανακύκλωσα' }).click();
  await page.getByText('Το έντυπο ανακυκλώθηκε').first().waitFor();
  await page.getByText('WAU28PH9BY.pdf').waitFor();

  step('εγγύηση');
  await page.locator('#w-date').fill('2025-03-14');
  await page.getByRole('button', { name: '2 χρόνια' }).click();
  await page.getByText('Εγγύηση έως 14 Μαρ 2027').first().waitFor();
  await page.locator('#w-store').fill('Ηλεκτρικά Παπαδόπουλος');
  await page.locator('#w-price').fill('499');
  await page.locator('#w-price').blur();

  step('παραστατικό με εισαγωγή αρχείου → πρόταση ημερομηνίας');
  await page.locator('#w-date').fill('');
  await page.locator('section:has-text("Παραστατικό αγοράς") label:has-text("Αρχείο") input[type=file]').setInputFiles(files.receipt);
  await page.getByText('Ημερομηνία αγοράς από την απόδειξη;').waitFor({ timeout: 120_000 });
  await page.getByRole('button', { name: '14 Μαρ 2025' }).click();
  await page.waitForFunction(() => document.querySelector('#w-date').value === '2025-03-14'); // η αποθήκευση είναι ασύγχρονη

  step('σημειώσεις, χώρος, ετικέτες');
  await page.locator('#d-notes').fill('Καθάρισμα φίλτρου αντλίας κάθε 3 μήνες');
  await page.locator('#d-room').fill('Μπάνιο');
  await page.locator('#d-tags').fill('δώρο, εξοχικό');
  await page.locator('#d-tags').blur();
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('07-item');
  await page.screenshot({ path: path.join(OUT, '07b-item-full.png'), fullPage: true });

  step('δεύτερο προϊόν χωρίς σάρωση');
  await page.getByRole('button', { name: 'Πίσω στη βιβλιοθήκη' }).click();
  await page.goto(`${BASE}#/scan?manual=1`);
  await page.locator('#d-name').waitFor();
  await page.locator('#d-name').fill('Ψυγειοκαταψύκτης');
  await page.locator('#d-brand').fill('Samsung');
  await page.locator('#d-model').fill('RB34T632ESA');
  await page.locator('#d-cat').selectOption('kitchen');
  await page.locator('#w-date').fill('2020-01-10');
  await page.getByRole('button', { name: '1 χρόνος' }).click();
  await page.locator('#d-model').blur();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: 'Πίσω στη βιβλιοθήκη' }).click();

  step('αναζήτηση και φίλτρα');
  const cards = page.locator('ul > li a[href^="#/item/"]');
  await cards.first().waitFor();
  assert.equal(await cards.count(), 2);
  await shot('08-library');
  const search = page.getByRole('searchbox');
  for (const [q, n] of [['πλυντ', 1], ['psyg', 1], ['wau28', 1], ['samsnug', 1], ['φιλτρο', 1], ['εξοχικο', 1], ['παπαδοπουλος', 1], ['zzz', 0], ['', 2]]) {
    await search.fill(q);
    await page.waitForTimeout(150);
    assert.equal(await cards.count(), n, `αναζήτηση «${q}»`);
  }
  await search.fill('bosch');
  await page.waitForTimeout(200);
  await shot('09-search');
  await search.fill('');
  await page.getByRole('button', { name: /^Χωρίς ψηφιακό/ }).click();
  assert.equal(await cards.count(), 1);
  await page.getByRole('button', { name: /^Χωρίς ψηφιακό/ }).click();
  await page.getByRole('button', { name: /^Φίλτρα/ }).click();
  await page.getByRole('heading', { name: 'Φίλτρα' }).waitFor();
  await page.getByRole('button', { name: /^Έχει λήξει/ }).click();
  await page.waitForTimeout(400);
  await shot('10-filters');
  await page.getByRole('button', { name: 'Εμφάνιση 1 προϊόντος' }).click();
  assert.equal(await cards.count(), 1);
  await page.getByRole('button', { name: 'Καθαρισμός', exact: true }).click();
  assert.equal(await cards.count(), 2);

  step('κρυπτογράφηση: στον δίσκο δεν φαίνεται περιεχόμενο');
  const disk = await page.evaluate(async () => {
    const db = await new Promise((res, rej) => { const r = indexedDB.open('manuals-v1'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const all = (store) => new Promise((res) => { const r = db.transaction(store).objectStore(store).getAll(); r.onsuccess = () => res(r.result); });
    const td = new TextDecoder();
    const view = (rec) => ({ keys: Object.keys(rec).sort().join(','), text: rec.ct instanceof ArrayBuffer ? td.decode(rec.ct) : JSON.stringify(rec) });
    return { items: (await all('items')).map(view), blobs: (await all('blobs')).map(view) };
  });
  assert.ok(disk.items.length >= 2 && disk.blobs.length >= 3, 'υπάρχουν εγγραφές');
  for (const r of disk.items) assert.equal(r.keys, 'ct,id,iv');
  for (const r of disk.blobs) assert.equal(r.keys, 'ct,iv');
  for (const r of [...disk.items, ...disk.blobs]) for (const secret of ['WAU28', 'Bosch', 'Παπαδόπουλος', 'φίλτρου', '%PDF', 'application/pdf']) assert.ok(!r.text.includes(secret), `στον δίσκο φαίνεται «${secret}»`);

  step('ρυθμίσεις, σκοτεινή εμφάνιση, αντίγραφο ασφαλείας');
  await page.getByRole('link', { name: 'Ρυθμίσεις' }).click();
  await shot('11-settings');
  await page.getByRole('radio', { name: 'Σκοτεινή' }).click();
  await page.getByRole('link', { name: 'Βιβλιοθήκη' }).click();
  await cards.first().waitFor();
  await shot('12-library-dark');
  await cards.first().click();
  await page.getByRole('heading', { level: 1 }).waitFor();
  await page.waitForTimeout(400);
  await shot('13-item-dark');
  await page.getByRole('button', { name: 'Πίσω στη βιβλιοθήκη' }).click();
  await page.getByRole('link', { name: 'Ρυθμίσεις' }).click();
  await page.getByRole('radio', { name: 'Φωτεινή' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Εξαγωγή' }).click()]);
  const backup = path.join(OUT, 'backup.zip');
  await download.saveAs(backup);

  // ---------- «άλλη συσκευή»: iPad, άδεια, εισαγωγή του αντιγράφου ----------
  step('iPad: εισαγωγή αντιγράφου σε άδεια συσκευή, δύο στήλες');
  const ipad = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, hasTouch: true, locale: 'el-GR' });
  const tab = await ipad.newPage();
  watch(tab);
  await tab.goto(`${BASE}#/settings`);
  await tab.locator('label:has-text("Εισαγωγή") input[type=file]').setInputFiles(backup);
  const tcards = tab.locator('aside ul > li a[href^="#/item/"]');
  await tcards.first().waitFor();
  assert.equal(await tcards.count(), 2);
  await tab.getByRole('link', { name: /Πλυντήριο|Bosch/ }).first().click();
  await tab.getByText('WAU28PH9BY.pdf').waitFor();          // το PDF ήρθε μαζί
  await tab.getByText('Το έντυπο ανακυκλώθηκε').first().waitFor();
  assert.equal(await tab.locator('#d-notes').inputValue(), 'Καθάρισμα φίλτρου αντλίας κάθε 3 μήνες');
  await tab.waitForTimeout(500);
  await shot('14-ipad', tab);
  // δεύτερη εισαγωγή του ίδιου αντιγράφου: καμία διπλή εγγραφή
  await tab.goto(`${BASE}#/settings`);
  await tab.locator('label:has-text("Εισαγωγή") input[type=file]').setInputFiles(backup);
  await tab.getByText('0 νέα προϊόντα').waitFor();
  assert.equal(await tcards.count(), 2);
  await shot('15-ipad-settings', tab);

  // ---------- παλιά απλά δεδομένα (από πριν την κρυπτογράφηση) ----------
  step('μετάβαση: παλιές απλές εγγραφές διαβάζονται και ξαναγράφονται κρυπτογραφημένες');
  const legacy = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'el-GR' });
  const lp = await legacy.newPage();
  watch(lp);
  // ο browser ζητά /favicon.ico για σελίδα που δεν είναι HTML: απάντηση χωρίς περιεχόμενο, όχι 404
  await legacy.route('**/favicon.ico', (r) => r.fulfill({ status: 204 }));
  await lp.goto(BASE + 'manifest.webmanifest'); // ίδιο origin, χωρίς να ξεκινήσει η εφαρμογή
  await lp.evaluate(async () => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open('manuals-v1', 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('items', { keyPath: 'id' }); r.result.createObjectStore('blobs'); r.result.createObjectStore('meta'); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    const now = Date.now();
    const item = { id: 'legacyItem000000000001', createdAt: now, updatedAt: now, name: 'Παλιό τοστιέρα', brand: 'Izzy', model: 'T100', serial: '', category: 'kitchen', room: '', tags: [], notes: 'παλιά σημείωση', purchase: {}, warranty: {},
      attachments: [{ id: 'legacyAtt0000000000001', kind: 'manual', name: 'old.pdf', mime: 'application/pdf', size: 8, blobId: 'legacyBlob00000000001', addedAt: now, origin: 'import' }], links: [], paper: 'kept' };
    const tx = db.transaction(['items', 'blobs'], 'readwrite');
    tx.objectStore('items').put(item);
    tx.objectStore('blobs').put({ mime: 'application/pdf', data: new TextEncoder().encode('%PDF-1.4').buffer }, 'legacyBlob00000000001');
    await new Promise((res) => { tx.oncomplete = res; });
    db.close();
  });
  await lp.goto(BASE);
  await lp.getByText('Παλιό τοστιέρα').waitFor();
  await lp.getByText('Παλιό τοστιέρα').click();
  await lp.getByText('old.pdf').waitFor();
  const after = await lp.evaluate(async () => {
    const db = await new Promise((res) => { const r = indexedDB.open('manuals-v1'); r.onsuccess = () => res(r.result); });
    const get = (store, key) => new Promise((res) => { const r = db.transaction(store).objectStore(store).get(key); r.onsuccess = () => res(r.result); });
    const it = await get('items', 'legacyItem000000000001');
    return { itemKeys: Object.keys(it).sort().join(',') };
  });
  assert.equal(after.itemKeys, 'ct,id,iv');

  // ---------- αγγλικά ----------
  step('αγγλικά');
  const en = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'en-GB' });
  const ep = await en.newPage();
  watch(ep);
  await ep.goto(BASE);
  await ep.getByRole('heading', { name: 'Library' }).waitFor();
  await shot('16-english', ep);

  assert.deepEqual(errors, [], 'σφάλματα κονσόλας');
  console.log(`\nOK — στιγμιότυπα στο ${OUT}`);
} catch (e) {
  console.error('\nΑΠΟΤΥΧΙΑ:', e.message);
  // στιγμιότυπο κάθε ανοιχτής σελίδας τη στιγμή της αποτυχίας
  let n = 0;
  for (const ctx of browser.contexts()) for (const p of ctx.pages()) await p.screenshot({ path: path.join(OUT, `fail-${++n}.png`), fullPage: true }).catch(() => {});
  if (errors.length) console.error('σφάλματα κονσόλας:', errors);
  process.exitCode = 1;
} finally {
  await browser.close();
  stop();
}
