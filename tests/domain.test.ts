import test from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, daysBetween, parseIso } from '@/domain/dates';
import { warrantyInfo } from '@/domain/warranty';
import { latin, norm, within1 } from '@/domain/text';
import { classifyCode, eanOk, parseHttpUrl } from '@/domain/codes';
import { identify } from '@/domain/identify';
import { cleanLine, coverLayout } from '@/domain/coverLayout';
import { formatTitle, oembedUrl, parseHead } from '@/domain/linkPreview';
import { brandQueries, describesBrand, sameWord } from '@/domain/brandLookup';
import { localManualLanguage, manualQueries } from '@/domain/manualSearch';
import { suggestCategory } from '@/domain/categorySuggest';
import { recyclingStats } from '@/domain/recycling';
import { mergeItems, referencedBlobs } from '@/domain/merge';
import { checkReceipt, extractDates } from '@/domain/receiptHints';
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

test('manualQueries: πρώτα αγγλικά, μετά η γλώσσα του χρήστη', () => {
  const q = manualQueries({ brand: 'Bosch', model: 'WAU28PH9BY', name: '' }, 'duckduckgo', 'el');
  assert.deepEqual(q.map((x) => [x.id, x.lang]), [['pdf', 'en'], ['support', 'en'], ['local', 'el']]);
  assert.equal(q[0]!.query, 'Bosch "WAU28PH9BY" user manual filetype:pdf');
  assert.ok(q[2]!.query.includes('εγχειρίδιο χρήσης'));
  assert.ok(manualQueries({ brand: '', model: '', name: 'Τοστιέρα' }, 'google', null)[0]!.url.startsWith('https://www.google.com/search?q='));
  assert.ok(manualQueries({ brand: 'Miele', model: 'X1', name: '' }, 'qwant', 'de')[2]!.url.startsWith('https://www.qwant.com/?q=Miele'));
  assert.equal(manualQueries({ brand: 'Miele', model: 'X1', name: '' }, 'brave', null).length, 2);
  assert.deepEqual(manualQueries({ brand: '', model: '', name: '' }, 'google', 'el'), []);
});

test('localManualLanguage: πρώτη γνωστή μη αγγλική γλώσσα', () => {
  assert.equal(localManualLanguage(['en-GB', 'el-GR']), 'el');
  assert.equal(localManualLanguage(['de-AT', 'el']), 'de');
  assert.equal(localManualLanguage(['en-US', 'en']), null);
  assert.equal(localManualLanguage(['xx', 'fr-CA']), 'fr');
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

test('suggestCategory: όνομα → βιβλιοθήκη (σειρά μοντέλου, μάρκα) → κείμενο', () => {
  const mk = (id: string, brand: string, model: string, category: Item['category']): Item => ({ ...emptyItem(1), id, brand, model, category });
  const lib = [mk('a', 'Bosch', 'WAU28PH9BY', 'laundry'), mk('b', 'Bosch', 'SMS4HVI33E', 'kitchen'), mk('c', 'Dyson', 'V15', 'laundry'), mk('d', 'Dyson', 'V8', 'laundry')];
  assert.equal(suggestCategory({ name: 'Πλυντήριο πιάτων', brand: 'Bosch', model: '' }, lib), 'kitchen');
  assert.equal(suggestCategory({ name: '', brand: 'bosch', model: 'WAU24PH0GR' }, lib), 'laundry');
  assert.equal(suggestCategory({ name: '', brand: 'Bosch', model: 'XYZ1' }, lib), null); // Bosch μοιρασμένη: καμία πρόταση
  assert.equal(suggestCategory({ name: '', brand: 'Dyson', model: 'Gen5' }, lib), 'laundry');
  assert.equal(suggestCategory({ name: '', brand: 'Acme', model: '', ocrText: 'Air conditioner user guide' }, lib), 'climate');
  assert.equal(suggestCategory({ id: 'c', name: '', brand: 'Dyson', model: 'V15' }, [lib[2]!]), null); // όχι από τον εαυτό του
});

test('model: νόμισμα τιμής ISO 4217, προαιρετικό', () => {
  const base = { ...emptyItem(1), purchase: { price: 10 } };
  assert.ok(itemSchema.safeParse(base).success);                                            // παλιά εγγραφή: ευρώ
  assert.ok(itemSchema.safeParse({ ...base, purchase: { price: 10, currency: 'USD' } }).success);
  assert.ok(!itemSchema.safeParse({ ...base, purchase: { price: 10, currency: 'usd' } }).success);
  assert.ok(!itemSchema.safeParse({ ...base, purchase: { price: 10, currency: '€' } }).success);
});

test('recyclingStats: ανακυκλωμένα / έτοιμα / χωρίς ψηφιακό, ποσοστά', () => {
  const manual = { id: 'm', kind: 'manual' as const, name: 'm.pdf', mime: 'application/pdf', size: 1, blobId: 'b', addedAt: 1, origin: 'import' as const };
  const a: Item = { ...emptyItem(1), paper: 'recycled', attachments: [manual] };
  const b: Item = { ...emptyItem(2), attachments: [manual] };
  const c: Item = { ...emptyItem(3) };
  const d: Item = { ...emptyItem(4), deleted: true };
  assert.deepEqual(recyclingStats([a, b, c, d]), { total: 3, recycled: 1, ready: 1, waiting: 1, recycledPct: 33, digitalPct: 67, pagesDigital: 0, paperGrams: 0, paperUnknown: 1, digitalPaperGrams: 0, co2Kg: 0, trees: 0 });
  assert.equal(recyclingStats([]).recycledPct, 0);
});

test('identify: οχήματα — μάρκα και όνομα μοντέλου μετά τη μάρκα', () => {
  const car = identify({ latin: "TOYOTA COROLLA\nOwner's Manual\nThis car is equipped with seat belts", greek: '' });
  assert.equal(car.category, 'vehicle');
  assert.equal(car.brands[0], 'Toyota');
  assert.equal(car.models[0], 'COROLLA');
  const tesla = identify({ latin: 'Tesla Model 3 Owner Manual — car', greek: '' });
  assert.deepEqual([tesla.brands[0], tesla.models[0]], ['Tesla', 'Model 3']);
  const vw = identify({ latin: 'Volkswagen Owner’s Manual Golf car', greek: 'Εγχειρίδιο αυτοκινήτου' });
  assert.equal(vw.brands[0], 'Volkswagen');
  assert.ok(!vw.models.includes('Owner’s'));                     // γενική λέξη, όχι μοντέλο
  // σε συσκευή δεν εφαρμόζεται: εκεί μοντέλο είναι ο κωδικός
  assert.equal(identify({ latin: 'Bosch Serie 6 washing machine WAU28PH9BY', greek: '' }).models[0], 'WAU28PH9BY');
});

test('checkReceipt: ημερομηνία + ποσό ή λέξη παραστατικού → μοιάζει με παραστατικό', () => {
  const today = '2026-11-23';
  assert.equal(checkReceipt('ΗΛΕΚΤΡΙΚΑ ΠΑΠΑΔΟΠΟΥΛΟΣ\nΑΦΜ 099999999\n14/03/2025\nΣΥΝΟΛΟ 499,00 €', today).likely, true);
  assert.equal(checkReceipt('Απόδειξη λιανικής 14-03-2025', today).likely, true);               // τόνοι και πεζά
  assert.equal(checkReceipt('MediaMarkt  Rechnung  12.01.2026  Summe 89,99 EUR', today).likely, true);
  assert.equal(checkReceipt('Scontrino 05/06/2025 Totale 12,50', today).likely, true);
  assert.equal(checkReceipt('Washing machine safety instructions. Read carefully.', today).likely, false); // καμία ένδειξη
  assert.equal(checkReceipt('Total 12,50 €', today).likely, false);                                    // χωρίς ημερομηνία
  assert.equal(checkReceipt('Έκδοση 14/03/2025 — οδηγίες χρήσης', today).likely, false);             // ημερομηνία μόνο
  assert.equal(checkReceipt('', today).likely, false);
});

test('identify: μοντέλο-όνομα ως πρόταση όταν δεν υπάρχει κωδικός (πραγματικό OCR εξωφύλλου Olight Baton Turbo)', () => {
  // απόσπασμα από το OCR (eng, sparse) της σάρωσης του χρήστη· τα «LEG», «mY;», «Ny» είναι θόρυβος από το σχέδιο
  const latin = 'QOLIGHT\nUSER\nMANUAL\na\nLEG\nmY;\nLID\nNU,\nNy\nIv\nTm NR\nBaton\nPortable, long-range EDC flashlight';
  const r = identify({ latin, greek: '' });
  assert.deepEqual(r.models, []);                 // κανένας κωδικός → τίποτα δεν συμπληρώνεται μόνο του
  assert.deepEqual(r.modelHints, ['Baton']);      // μόνο ως πρόταση· όχι ο θόρυβος, όχι «USER MANUAL»
  assert.equal(r.category, 'tools');             // «flashlight» → Εργαλεία & κήπος
});

test('coverLayout: πραγματικές γραμμές OCR της Apple (iPhone, εξώφυλλο Olight Baton Turbo)', () => {
  // από τη «Δοκιμή αναγνώρισης» στη συσκευή: [ύψος ×1000] κείμενο
  const lines = [
    { text: 'MANUAL', size: 0.053 }, { text: 'USER', size: 0.053 }, { text: 'Portable, long-range EDC flashlight.', size: 0.032 },
    { text: 'OBLIGHT', size: 0.029 }, { text: 'Baton Turbo', size: 0.026 },
  ];
  const r = coverLayout(lines);
  assert.deepEqual(r.brandCandidates, ['OBLIGHT']);                  // όχι USER/MANUAL, όχι η περιγραφή
  assert.deepEqual(r.modelHints, ['OBLIGHT', 'Baton Turbo']);        // το OBLIGHT φεύγει όταν επιβεβαιωθεί ως μάρκα
});

test('brandLookup: παραλλαγές με ένα γράμμα λιγότερο και κανόνας αποδοχής', () => {
  assert.ok(brandQueries('OBLIGHT').includes('olight'));
  assert.ok(brandQueries('QOLIGHT').includes('olight'));
  assert.deepEqual(brandQueries('LG'), ['lg']);
  assert.equal(describesBrand('Chinese flashlight brand'), true);
  assert.equal(describesBrand('German multinational engineering company'), true);
  assert.equal(describesBrand('stick used by a conductor'), false);
  assert.equal(sameWord('Olight', 'olight'), true);
  assert.equal(sameWord('Olight Inc', 'olight'), false);
});

test('cleanLine: πλαίσιο γύρω από λέξη διαβασμένο ως παρένθεση (πραγματικό: «Baton (Turbo» από iPhone)', () => {
  assert.equal(cleanLine('Baton (Turbo'), 'Baton Turbo');
  assert.equal(cleanLine('Baton Turbo)'), 'Baton Turbo');
  assert.equal(cleanLine('|Baton| Turbo'), 'Baton Turbo');
  assert.equal(cleanLine('Galaxy S24 (2024)'), 'Galaxy S24 (2024)');   // σωστή παρένθεση μένει
  assert.equal(coverLayout([{ text: 'Baton (Turbo', size: 0.03 }]).modelHints[0], 'Baton Turbo');
});

test('linkPreview: oEmbed για βίντεο, τίτλος και εικονίδια από τη σελίδα, μορφή τίτλου', () => {
  assert.equal(oembedUrl('https://youtu.be/abc'), 'https://www.youtube.com/oembed?format=json&url=https%3A%2F%2Fyoutu.be%2Fabc');
  assert.ok(oembedUrl('https://vimeo.com/76979871')!.startsWith('https://vimeo.com/api/oembed.json?url='));
  assert.equal(oembedUrl('https://www.bosch-home.gr/manual'), null);
  const html = '<html><head><title>X7 &amp; Co | Support</title><link rel="icon" href="/fav.png"><link rel="apple-touch-icon" href="https://cdn.ex.com/touch.png"></head>';
  const r = parseHead(html, 'https://www.example.com/p/1');
  assert.equal(r.title, 'X7 & Co | Support');
  assert.deepEqual(r.icons, ['https://cdn.ex.com/touch.png', 'https://www.example.com/fav.png', 'https://www.example.com/favicon.ico']);
  assert.equal(parseHead('<meta property="og:title" content="Baton Turbo — Olight">', 'https://olight.com/').title, 'Baton Turbo — Olight');
  assert.equal(formatTitle('YouTube', 'X7 Usage EN'), 'YouTube — X7 Usage EN');
  assert.equal(formatTitle('YouTube', 'YouTube Kids'), 'YouTube Kids');
  assert.equal(formatTitle(null, '  Οδηγίες&nbsp;χρήσης '), 'Οδηγίες χρήσης');
});
