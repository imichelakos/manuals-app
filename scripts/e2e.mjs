// Δοκιμή από άκρη σε άκρη στο build (dist), σε Chromium με διαστάσεις κινητού και iPad:
// σάρωση εξωφύλλου (OCR + QR) → αποθήκευση → κατέβασμα PDF → ανακύκλωση → εγγύηση → παραστατικό → αναζήτηση/φίλτρα →
// αντίγραφο ασφαλείας (εξαγωγή, εισαγωγή σε «άλλη συσκευή»). Αποτυγχάνει και σε οποιοδήποτε σφάλμα κονσόλας (π.χ. CSP).
// Χρήση: npm run build && npm run e2e   (χρειάζεται εγκατεστημένο το playwright με Chromium)
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
const PDF_BYTES = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 3>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');

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
  assert.equal(await page.getByRole('button', { name: '1 χρόνος' }).count(), 0); // με επιλεγμένη διάρκεια οι άλλες κρύβονται
  await page.getByRole('button', { name: /^2 χρόνια/ }).click();                 // νέο πάτημα: ξανά όλες οι επιλογές
  await page.getByRole('button', { name: '1 χρόνος' }).waitFor();
  // «Άλλη» σε χρόνια (προεπιλογή): 8 → 96 μήνες, chip «8 χρόνια»
  const otherYears = page.getByLabel('Διάρκεια εγγύησης σε χρόνια');
  await otherYears.pressSequentially('8');
  await otherYears.press('Enter');
  await page.getByRole('button', { name: /^8 χρόνια/, pressed: true }).waitFor();
  await page.getByText('Εγγύηση έως 14 Μαρ 2033').first().waitFor();
  await page.getByRole('button', { name: /^8 χρόνια/ }).click();
  // «Άλλη» σε μήνες: διψήφιος αριθμός πληκτρολογημένος ψηφίο-ψηφίο (το πεδίο δεν πρέπει να αδειάζει στη μέση)
  await page.getByLabel('Μονάδα').selectOption('months');
  const other = page.getByLabel('Διάρκεια εγγύησης σε μήνες');
  await other.pressSequentially('30');
  assert.equal(await other.inputValue(), '30');
  await other.press('Enter');                                          // αποθήκευση → γίνεται chip
  await page.getByRole('button', { name: /^30 μήνες/, pressed: true }).waitFor();
  await page.getByText('Εγγύηση έως 14 Σεπ 2027').first().waitFor();
  assert.equal(await other.count(), 0);                                // «Άλλη» κρύβεται όσο υπάρχει διάρκεια
  await page.getByRole('button', { name: /^30 μήνες/ }).click();
  await page.getByRole('button', { name: '2 χρόνια' }).click();
  await page.getByText('Εγγύηση έως 14 Μαρ 2027').first().waitFor();
  // συγκεκριμένη ημερομηνία λήξης: κρυφή μέχρι να ζητηθεί, υπερισχύει, καταργείται
  assert.equal(await page.locator('#w-until').count(), 0);
  await page.getByRole('button', { name: 'Λήγει σε άλλη ημερομηνία;' }).click();
  await page.locator('#w-until').fill('2027-06-30');
  await page.locator('#w-until').scrollIntoViewIfNeeded();
  await shot('06b-warranty', page);
  await page.getByText('Εγγύηση έως 30 Ιουν 2027').first().waitFor();
  await page.getByRole('button', { name: 'Κατάργηση ημερομηνίας λήξης' }).click();
  await page.getByText('Εγγύηση έως 14 Μαρ 2027').first().waitFor();
  assert.equal(await page.locator('#w-until').count(), 0);
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
  // γενικές συμβουλές ανακύκλωσης της συσκευής
  await page.getByText('Όταν δεν θα τη χρειάζεσαι').click();
  await page.getByText(/Πολλοί κατασκευαστές και καταστήματα/).waitFor();
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
  await page.locator('#d-model').blur();
  await page.getByRole('button', { name: 'Πρόταση: Κουζίνα' }).click(); // κατηγορία από το όνομα
  await page.waitForFunction(() => document.querySelector('#d-cat').value === 'kitchen');
  await page.locator('#w-date').fill('2025-10-10'); // λήγει 10/10/2026: έληξε πριν από λίγο → ειδοποιήσεις στη λίστα
  await page.getByRole('button', { name: '1 χρόνος' }).click();
  // εγγύηση μέρους: η κύρια έχει λήξει, ο συμπιεστής καλύπτεται 10 χρόνια
  await page.getByRole('button', { name: 'Εγγύηση για μέρος' }).click();
  await page.getByLabel('Μέρος').fill('Συμπιεστής');
  await page.getByLabel('Μέρος').blur();
  await page.getByLabel('Διάρκεια', { exact: true }).fill('10');
  await page.getByLabel('Διάρκεια', { exact: true }).blur();
  await page.getByText('Εγγύηση έως 10 Οκτ 2035').waitFor();
  await page.getByLabel('Μέρος').scrollIntoViewIfNeeded();
  await shot('07c-part-warranty', page);
  await page.locator('#d-model').blur();
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: 'Πίσω στη βιβλιοθήκη' }).click();

  step('αναζήτηση και φίλτρα');
  const cards = page.locator('ul > li a[href^="#/item/"]');
  await cards.first().waitFor();
  assert.equal(await cards.count(), 2);
  await cards.filter({ hasText: 'Samsung' }).getByText('Κουζίνα').waitFor(); // κατηγορία με εικονίδιο στην κάρτα
  await cards.filter({ hasText: 'Samsung' }).getByText('+1 μέρος σε εγγύηση').waitFor();
  await page.getByText('σελίδες σε ψηφιακή μορφή').waitFor();          // 3 σελίδες στο PDF → 2 φύλλα → ≈ 5 g
  await page.getByText('≈ 5 g').waitFor();
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
  await page.getByRole('button', { name: /^Samsung/ }).click();               // μάρκα
  await page.getByRole('button', { name: 'Εμφάνιση 1 προϊόντος' }).waitFor();
  await page.getByRole('button', { name: /^Samsung/ }).click();
  await page.getByRole('button', { name: /^Μεγάλες συσκευές 2/ }).waitFor();   // ψυγειοκαταψύκτης + πλυντήριο ρούχων: ομάδα από το όνομα
  await page.getByRole('button', { name: /^Έχει λήξει/ }).click();
  await page.waitForTimeout(400);
  await shot('10-filters');
  await page.getByRole('button', { name: 'Εμφάνιση 1 προϊόντος' }).click();
  assert.equal(await cards.count(), 1);
  await page.getByRole('button', { name: 'Καθαρισμός', exact: true }).click();
  assert.equal(await cards.count(), 2);

  step('ειδοποιήσεις: κρατιούνται στη λίστα μέχρι να σβηστούν (σύρσιμο ή ×)');
  await page.getByRole('button', { name: 'Ειδοποιήσεις: 1' }).click(); // έληξε: μένει μόνο η ειδοποίηση της ημέρας λήξης
  await page.getByRole('heading', { name: 'Ειδοποιήσεις' }).waitFor();
  await page.getByText('Η εγγύηση έληξε').first().waitFor();     // ο τίτλος λογαριάζεται από σήμερα
  await page.waitForTimeout(400);
  await shot('10b-inbox');
  const first = page.locator('[role=dialog] li > div').first();
  const box = await first.boundingBox();
  await page.mouse.move(box.x + box.width - 40, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 120, box.y + box.height / 2, { steps: 6 });
  await page.mouse.move(box.x + 20, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await page.getByText('Δεν υπάρχουν ειδοποιήσεις.').waitFor();    // σβήστηκε με σύρσιμο
  await page.getByRole('button', { name: 'Κλείσιμο' }).click();
  await page.getByRole('button', { name: 'Ειδοποιήσεις', exact: true }).waitFor();

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
  await page.getByRole('button', { name: 'Εξαγωγή' }).click();
  const pw1 = page.getByLabel('Κωδικός', { exact: true }), pw2 = page.getByLabel('Ξανά ο κωδικός');
  await pw1.fill('abc123');
  await page.getByText('Τουλάχιστον 12 χαρακτήρες.').waitFor();             // αδύναμος κωδικός: όχι εξαγωγή
  await pw1.fill('Πορτοκαλί-ποδήλατο 42');
  await pw2.fill('Πορτοκαλί-ποδήλατο 4');
  await page.getByText('Οι δύο κωδικοί δεν είναι ίδιοι.').waitFor();
  assert.ok(await page.locator('button[form="backup-pw"]').isDisabled());
  await pw2.fill('Πορτοκαλί-ποδήλατο 42');
  await page.waitForTimeout(400); // τέλος της κίνησης του φύλλου
  await shot('11b-backup-password');
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('button[form="backup-pw"]').click()]);
  assert.match(download.suggestedFilename(), /\.mbackup$/);
  const backup = path.join(OUT, 'backup.mbackup');
  await download.saveAs(backup);
  const raw = readFileSync(backup);
  assert.equal(raw.subarray(0, 7).toString(), 'MNLSBAK');
  for (const plain of ['manifest.json', 'Bosch', 'WAU28PH9BY', 'Παπαδόπουλος']) assert.equal(raw.includes(Buffer.from(plain)), false, `φαίνεται «${plain}» στο αντίγραφο`);

  // ---------- «άλλη συσκευή»: iPad, άδεια, εισαγωγή του αντιγράφου ----------
  step('iPad: εισαγωγή αντιγράφου σε άδεια συσκευή, δύο στήλες');
  const ipad = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, hasTouch: true, locale: 'el-GR' });
  const tab = await ipad.newPage();
  watch(tab);
  await tab.goto(`${BASE}#/settings`);
  await tab.locator('label:has-text("Εισαγωγή") input[type=file]').setInputFiles(backup);
  await tab.getByLabel('Κωδικός', { exact: true }).fill('λάθος κωδικός');
  await tab.locator('button[form="backup-pw"]').click();
  await tab.getByText('Λάθος κωδικός — ή το αρχείο έχει αλλοιωθεί.').waitFor({ timeout: 30_000 });
  await tab.getByLabel('Κωδικός', { exact: true }).fill('Πορτοκαλί-ποδήλατο 42');
  await tab.locator('button[form="backup-pw"]').click();
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
  await tab.getByLabel('Κωδικός', { exact: true }).fill('Πορτοκαλί-ποδήλατο 42');
  await tab.locator('button[form="backup-pw"]').click();
  await tab.getByText('0 νέα προϊόντα').waitFor({ timeout: 30_000 });
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

  // ---------- κλειδί web → Keychain (εφαρμογή iOS όπου τα plugins Swift εμφανίζονται αργότερα) ----------
  step('μετάβαση κλειδιού: δεδομένα με κλειδί web, μετά εμφανίζεται Keychain (προσομοίωση iOS)');
  // προσομοίωση της γέφυρας iOS του Capacitor: πλατφόρμα «ios», plugin SecureKey με «Keychain» στο localStorage
  await legacy.addInitScript(() => {
    window.webkit = { messageHandlers: { bridge: { postMessage() {} } } };
    window.Capacitor = {
      PluginHeaders: [
        { name: 'SecureKey', methods: [{ name: 'storageKey', rtype: 'promise' }, { name: 'deleteStorageKey', rtype: 'promise' }] },
        { name: 'PdfReader', methods: [{ name: 'read', rtype: 'promise' }] },
        { name: 'LocalNotifications', methods: [{ name: 'addListener' }, { name: 'removeListener' }, ...['checkPermissions', 'requestPermissions', 'getPending', 'schedule', 'cancel'].map((name) => ({ name, rtype: 'promise' }))] },
      ],
      nativeCallback: () => 'mock-callback',
      nativePromise: async (plugin, method, o) => {
        if (plugin === 'PdfReader' && method === 'read' && window.__mockLogoOnly) {
          // η μάρκα μόνο ως λογότυπο: το κείμενο δεν τη γράφει· το εξώφυλλο (εικόνα) τη δείχνει → OCR
          return { pages: 12, locked: false, cover: window.__mockCover ?? null, page2: null, pageTexts: ['Owner manual\nModel: WAU28PH9BY', 'Washing machine safety instructions'] };
        }
        if (plugin === 'PdfReader' && method === 'read') {
          // «PDFKit»: κείμενο των πρώτων σελίδων και πρώτη σελίδα ως εικόνα (εδώ: το εξώφυλλο της δοκιμής)
          // 1η σελίδα: εξώφυλλο· 2η: περιεχόμενα με λέξεις που ΔΕΝ πρέπει να γίνουν μάρκα («Seat», «Smart»)
          return { pages: 24, locked: false, cover: window.__mockCover ?? null, pageTexts: ['Bosch Serie 6\nWashing machine\nModel: WAU28PH9BY\nInstruction manual', 'Seat the appliance firmly. Smart programmes. Οδηγίες χρήσης πλυντηρίου ρούχων'] };
        }
        if (plugin === 'LocalNotifications') {
          // προσομοίωση: άδεια δίνεται στο πρώτο αίτημα· οτιδήποτε άλλο (π.χ. μια «then») είναι σφάλμα
          const granted = localStorage.getItem('mock-notif') === 'granted';
          if (method === 'checkPermissions') return { display: granted ? 'granted' : 'prompt' };
          if (method === 'requestPermissions') { localStorage.setItem('mock-notif', 'granted'); return { display: 'granted' }; }
          if (method === 'getPending') return { notifications: [] };
          if (method === 'schedule' || method === 'cancel' || method === 'removeListener') return {};
        }
        if (plugin === 'SecureKey' && method === 'storageKey') {
          let k = localStorage.getItem('mock-keychain');
          if (!k && o.create) { k = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))); localStorage.setItem('mock-keychain', k); }
          return { key: k };
        }
        throw new Error(`mock: ${plugin}.${method}`);
      },
    };
  });
  const webKeyCount = () => lp.evaluate(() => new Promise((res) => {
    const r = indexedDB.open('manuals-keys', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('k');
    r.onsuccess = () => { const c = r.result.transaction('k').objectStore('k').count(); c.onsuccess = () => { res(c.result); r.result.close(); }; };
  }));
  assert.equal(await webKeyCount(), 1); // τα δεδομένα είναι ακόμη με κλειδί web
  await lp.goto(BASE);
  await lp.getByText('Παλιό τοστιέρα').click();
  await lp.getByText('old.pdf').waitFor();                    // ξανακρυπτογραφήθηκαν με το νέο κλειδί χωρίς απώλεια
  assert.equal(await webKeyCount(), 0);                         // το κλειδί web σβήστηκε
  assert.ok(await lp.evaluate(() => !!localStorage.getItem('mock-keychain')));
  await lp.goto(`${BASE}#/settings`);
  await lp.getByText('Keychain της συσκευής').waitFor();
  await lp.reload();                                            // δεύτερη εκκίνηση: μόνο με το Keychain
  await lp.goto(BASE);
  await lp.getByText('Παλιό τοστιέρα').click();
  await lp.getByText('old.pdf').waitFor();                      // το αρχείο (το μόνο blob) το επαληθεύει ήδη το openVault με το νέο κλειδί· χωρίς άνοιγμα (θέλει το plugin αρχείων)

  step('υπενθυμίσεις: ο διακόπτης ανοίγει (προσομοίωση iOS με LocalNotifications)');
  await lp.goto(`${BASE}#/settings`);
  const remSwitch = lp.getByRole('switch', { name: 'Υπενθύμιση λήξης εγγύησης' });
  await remSwitch.click();
  await lp.waitForFunction(() => document.querySelector('[role=switch][aria-label="Υπενθύμιση λήξης εγγύησης"]')?.getAttribute('aria-checked') === 'true', null, { timeout: 5000 });
  // πολλαπλή επιλογή «πόσο νωρίς», έως 5
  await lp.getByRole('button', { name: '30 ημέρες πριν', pressed: true }).waitFor();          // προεπιλογή
  await lp.getByRole('button', { name: '7 ημέρες πριν' }).click();
  await lp.getByRole('button', { name: '60 ημέρες πριν' }).click();
  const otherDays = lp.getByLabel('Ημέρες πριν από τη λήξη');
  await otherDays.pressSequentially('14'); await otherDays.press('Enter');
  await lp.getByRole('button', { name: '14 ημέρες πριν', pressed: true }).waitFor();
  await otherDays.pressSequentially('3'); await otherDays.press('Enter');
  await lp.getByRole('button', { name: '3 ημέρες πριν', pressed: true }).waitFor();         // 5 επιλογές
  assert.equal(await lp.getByLabel('Ημέρες πριν από τη λήξη').count(), 0);                 // στο όριο: όχι «Άλλο»
  await lp.getByRole('switch', { name: 'Υπενθύμιση λήξης εγγύησης' }).scrollIntoViewIfNeeded();
  await shot('17-reminders', lp);
  await lp.getByRole('button', { name: '7 ημέρες πριν' }).click();                          // μία λιγότερη → ξανά «Άλλο»
  await lp.getByLabel('Ημέρες πριν από τη λήξη').waitFor();
  assert.deepEqual(await lp.evaluate(() => JSON.parse(localStorage.getItem('manuals-settings-v1')).reminderDays), [60, 30, 14, 3]);

  // ---------- αγγλικά ----------
  step('εισαγωγή PDF στη σάρωση — iOS (PDFKit): προσυμπλήρωση από το κείμενο του PDF');
  writeFileSync(path.join(OUT, 'Bosch-WAU28PH9BY-manual.pdf'), PDF_BYTES);
  await lp.evaluate((b64) => { window.__mockCover = b64; }, readFileSync(files.cover).toString('base64'));
  await lp.goto(`${BASE}#/scan`);
  await lp.locator('label:has-text("Εισαγωγή PDF") input[type=file]').setInputFiles(path.join(OUT, 'Bosch-WAU28PH9BY-manual.pdf'));
  await lp.getByRole('heading', { name: 'Τι βρήκαμε' }).waitFor({ timeout: 60_000 });
  assert.equal(await lp.locator('#sc-brand').inputValue(), 'Bosch');
  assert.equal(await lp.locator('#sc-model').inputValue(), 'WAU28PH9BY');
  await lp.getByAltText('Η πρώτη σελίδα του PDF').waitFor();
  await lp.waitForFunction(() => document.querySelector('#sc-cat').value === 'laundry');           // κατηγορία από το κείμενο
  await shot('18-pdf-review-ios', lp);
  await lp.getByRole('button', { name: /Αποθήκευση/ }).click();
  await lp.getByText('Bosch-WAU28PH9BY-manual.pdf').waitFor();                                       // το PDF έγινε το ψηφιακό
  assert.equal(await lp.getByRole('heading', { name: 'Βρες το ψηφιακό' }).count(), 0);              // χωρίς «βρες το ψηφιακό»

  step('εισαγωγή PDF — iOS: η μάρκα μόνο ως λογότυπο → OCR στο εξώφυλλο');
  writeFileSync(path.join(OUT, 'manual.pdf'), PDF_BYTES);
  await lp.evaluate(() => { window.__mockLogoOnly = true; });
  await lp.goto(`${BASE}#/scan`);
  await lp.locator('label:has-text("Εισαγωγή PDF") input[type=file]').setInputFiles(path.join(OUT, 'manual.pdf'));
  await lp.getByRole('heading', { name: 'Τι βρήκαμε' }).waitFor({ timeout: 120_000 });
  assert.equal(await lp.locator('#sc-brand').inputValue(), 'Bosch');       // από το OCR του εξωφύλλου («BOSCH» στην εικόνα)
  assert.equal(await lp.locator('#sc-model').inputValue(), 'WAU28PH9BY');
  await lp.evaluate(() => { window.__mockLogoOnly = false; });

  step('εισαγωγή PDF στη σάρωση — web (χωρίς PDFKit): από το όνομα του αρχείου');
  const pc = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'el-GR' });
  const pp = await pc.newPage();
  watch(pp);
  await pp.goto(`${BASE}#/scan`);
  await pp.locator('label:has-text("Εισαγωγή PDF") input[type=file]').setInputFiles(path.join(OUT, 'Bosch-WAU28PH9BY-manual.pdf'));
  await pp.getByRole('heading', { name: 'Τι βρήκαμε' }).waitFor({ timeout: 30_000 });
  assert.equal(await pp.locator('#sc-brand').inputValue(), 'Bosch');
  assert.equal(await pp.locator('#sc-model').inputValue(), 'WAU28PH9BY');
  await pp.getByRole('button', { name: /Αποθήκευση/ }).click();
  await pp.getByText('Bosch-WAU28PH9BY-manual.pdf').waitFor();

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
