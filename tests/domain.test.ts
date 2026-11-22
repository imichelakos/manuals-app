import test from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, daysBetween, parseIso } from '@/domain/dates';
import { warrantyInfo } from '@/domain/warranty';
import { latin, norm, within1 } from '@/domain/text';
import { classifyCode, eanOk, parseHttpUrl } from '@/domain/codes';
import { identify } from '@/domain/identify';
import { manualQueries } from '@/domain/manualSearch';
import { mergeItems, referencedBlobs } from '@/domain/merge';
import { extractDates } from '@/domain/receiptHints';
import { emptyItem, itemSchema, newId, displayName, type Item } from '@/domain/model';

test('dates: addMonths κρατά την ημέρα ή πάει στο τέλος του μήνα', () => {
  assert.equal(addMonths('2024-01-31', 1), '2024-02-29'); // δίσεκτο
  assert.equal(addMonths('2023-01-31', 1), '2023-02-28');
  assert.equal(addMonths('2024-11-15', 24), '2026-11-15');
  assert.equal(addMonths('2024-03-10', -3), '2023-12-10');
  assert.equal(addMonths('άκυρο', 1), null);
  assert.equal(parseIso('2023-02-30'), null);
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2); // πάνω από την αλλαγή ώρας (29/3/2026)
});

test('warranty: καταστάσεις', () => {
  const base = { purchase: { date: '2024-11-22' }, warranty: { months: 24 } };
  assert.deepEqual(warrantyInfo(base, '2026-11-22'), { state: 'expiring', until: '2026-11-22', daysLeft: 0 }); // η ημέρα λήξης καλύπτεται
  assert.equal(warrantyInfo(base, '2026-11-23').state, 'expired');
  assert.equal(warrantyInfo(base, '2026-09-23').state, 'expiring'); // 60 ημέρες
  assert.equal(warrantyInfo(base, '2026-09-22').state, 'active');   // 61 ημέρες
  assert.equal(warrantyInfo({ purchase: {}, warranty: { months: 24 } }, '2026-01-01').state, 'none');
  // η ρητή λήξη υπερισχύει
  assert.equal(warrantyInfo({ purchase: { date: '2020-01-01' }, warranty: { months: 24, until: '2030-01-01' } }, '2026-01-01').state, 'active');
});

test('text: κανονικοποίηση, λατινικά, ένα λάθος', () => {
  assert.equal(norm('Ψυγείο ΣΤΕΓΝΩΤΉΡΙΟΣ'), 'ψυγειο στεγνωτηριοσ');
  assert.equal(latin(norm('Ψυγείο')), 'psygeio');
  assert.ok(within1('samsung', 'samsnug')); // αντιμετάθεση
  assert.ok(within1('samsung', 'samsun'));  // αφαίρεση
  assert.ok(within1('samsung', 'samzung')); // αλλαγή
  assert.ok(!within1('samsung', 'sanzung'));
});

test('codes: σύνδεσμοι, barcode, κείμενο', () => {
  assert.equal(parseHttpUrl('javascript:alert(1)'), null);
  assert.equal(parseHttpUrl('ftp://example.com/x'), null);
  assert.equal(parseHttpUrl('WIFI:S:home;T:WPA;P:secret;;'), null);
  const yt = classifyCode('https://youtu.be/abc123');
  assert.ok(yt.type === 'link' && yt.kind === 'video' && !yt.insecure);
  const pdf = classifyCode('http://www.example.com/docs/manual_EL.PDF');
  assert.ok(pdf.type === 'link' && pdf.kind === 'pdf' && pdf.insecure && pdf.manualHint);
  const www = classifyCode('www.example.com/support');
  assert.ok(www.type === 'link' && www.url === 'https://www.example.com/support' && www.manualHint);
  const app = classifyCode('https://apps.apple.com/gr/app/x/id1');
  assert.ok(app.type === 'link' && app.kind === 'app');
  // δεν ξεγελιέται από όνομα που «μοιάζει» με γνωστό host
  const fake = classifyCode('https://youtube.com.evil.example/watch');
  assert.ok(fake.type === 'link' && fake.kind === 'web');
  assert.ok(eanOk('4006381333931') && eanOk('73513537') && eanOk('036000291452'));
  assert.ok(!eanOk('4006381333932') && !eanOk('123'));
  assert.deepEqual(classifyCode('4006381333931'), { type: 'ean', code: '4006381333931' });
  assert.deepEqual(classifyCode('SN: 12345'), { type: 'text', text: 'SN: 12345' });
});

test('identify: μάρκα, μοντέλο, κατηγορία από κείμενο εξωφύλλου', () => {
  // όπως τα δίνει το OCR: το λατινικό πέρασμα διαβάζει κωδικούς (και παραμορφώνει τα ελληνικά), το ελληνικό το αντίθετο
  const latin = 'SAMSUNG\nWuyelokataWuKtns\nEyxelpidlo xpnong\nMovtéo: RB34T632ESA\n220-240V 50Hz  EN60335  2012/19/EU\nwww.samsung.com';
  const greek = 'Ψυγειοκαταψύκτης\nΕγχειρίδιο χρήσης\nΜοντέλο: ΚΒ34Τ632Ε5Α\n220-240ν ΒΟΗΖ';
  const r = identify({ latin, greek }, ['https://www.samsung.com/gr/support']);
  assert.equal(r.brands[0], 'Samsung');
  assert.equal(r.models[0], 'RB34T632ESA');
  assert.ok(!r.models.some((m) => /240V|EN60335|2012/.test(m)));
  assert.equal(r.category, 'kitchen');
  assert.equal(r.productWord, 'Ψυγειοκαταψύκτης');
  const only = (latin: string, urls: string[] = []) => identify({ latin, greek: '' }, urls);
  // μάρκα μόνο από τη διεύθυνση του QR
  assert.deepEqual(only('Quick start guide', ['https://support.bosch-home.com/x', 'https://www.bosch.com/y']).brands, ['Bosch']);
  // κοινή λέξη με πεζά δεν είναι μάρκα· με κεφαλαίο είναι
  assert.deepEqual(only('keep the blade sharp and call your brother').brands, []);
  assert.deepEqual(only('SHARP Microwave Oven R-642').brands, ['Sharp']);
  assert.equal(only('Washing machine WAU28PH9BY user manual').category, 'laundry');
  assert.deepEqual(only('').models, []);
});

test('manualQueries: ερωτήσεις αναζήτησης', () => {
  const q = manualQueries({ brand: 'Bosch', model: 'WAU28PH9BY', name: '' }, 'duckduckgo');
  assert.equal(q[0]!.query, 'Bosch "WAU28PH9BY" user manual filetype:pdf');
  assert.ok(q[0]!.url.startsWith('https://duckduckgo.com/?q=Bosch%20%22WAU28PH9BY%22'));
  assert.ok(manualQueries({ brand: '', model: '', name: 'Τοστιέρα' }, 'google')[0]!.url.startsWith('https://www.google.com/search?q='));
  assert.deepEqual(manualQueries({ brand: '', model: '', name: '' }, 'google'), []);
});

test('merge: κερδίζει η νεότερη αλλαγή, οι διαγραφές μένουν', () => {
  const a: Item = { ...emptyItem(1000), name: 'A' };
  const b: Item = { ...emptyItem(1000), name: 'B' };
  const aNew: Item = { ...a, name: 'A2', updatedAt: 2000 };
  const bOld: Item = { ...b, name: 'B0', updatedAt: 500 };
  const bDeleted: Item = { ...b, deleted: true, updatedAt: 3000 };
  const c: Item = { ...emptyItem(1500), name: 'C' };
  const r = mergeItems([a, b], [aNew, bOld, c]);
  assert.deepEqual([r.added, r.updated, r.kept], [1, 1, 1]);
  assert.equal(r.items.find((i) => i.id === a.id)!.name, 'A2');
  assert.equal(r.items.find((i) => i.id === b.id)!.name, 'B');
  // διαγραφή σε άλλη συσκευή → περνά· παλιότερο αντίγραφο δεν την αναιρεί
  const r2 = mergeItems(mergeItems([a, b], [bDeleted]).items, [b]);
  assert.equal(r2.items.find((i) => i.id === b.id)!.deleted, true);
  const withFile: Item = { ...a, attachments: [{ id: newId(), kind: 'manual', name: 'm.pdf', mime: 'application/pdf', size: 1, blobId: 'blob-aaaaaaaa', thumbId: 'thumb-aaaaaaa', addedAt: 1, origin: 'import' }] };
  assert.deepEqual([...referencedBlobs([withFile, { ...withFile, id: newId(), deleted: true }])].sort(), ['blob-aaaaaaaa', 'thumb-aaaaaaa']);
});

test('receipt: ημερομηνίες από κείμενο παραστατικού', () => {
  const t = 'ΑΠΟΔΕΙΞΗ ΛΙΑΝΙΚΗΣ 14/03/2025 12:41\nΠροσφορά έως 31/12/2099\nΑΦΜ 094012345 5-2-24 2025-03-14 31/02/2025';
  assert.deepEqual(extractDates(t, '2026-11-22'), ['2025-03-14', '2024-02-05']);
});

test('model: σχήμα και εμφάνιση', () => {
  const i = emptyItem();
  assert.ok(itemSchema.safeParse(i).success);
  assert.ok(!itemSchema.safeParse({ ...i, category: 'x' }).success);
  assert.ok(!itemSchema.safeParse({ ...i, id: '../../etc' }).success);
  assert.ok(!itemSchema.safeParse({ ...i, purchase: { date: '14/03/2025' } }).success);
  assert.equal(displayName({ name: '', brand: 'Bosch', model: 'WAU28' }), 'Bosch WAU28');
  assert.equal(displayName({ name: 'Πλυντήριο', brand: 'Bosch', model: 'WAU28' }), 'Πλυντήριο');
  assert.match(newId(), /^[A-Za-z0-9_-]{22}$/);
});
