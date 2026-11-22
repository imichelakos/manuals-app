import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, facets, search, NO_FILTERS, activeFilterCount, type Filters } from '@/domain/search';
import { emptyItem, newId, type Item } from '@/domain/model';

const file = (kind: 'manual' | 'receipt') => ({ id: newId(), kind, name: `${kind}.pdf`, mime: 'application/pdf', size: 10, blobId: newId(), addedAt: 1, origin: 'import' as const });
const mk = (p: Partial<Item>, t: number): Item => ({ ...emptyItem(t), ...p });
const fridge = mk({ name: 'Ψυγειοκαταψύκτης', brand: 'Samsung', model: 'RB34T632ESA', category: 'kitchen', room: 'Κουζίνα', tags: ['εντοιχιζόμενο'], purchase: { date: '2025-01-10', store: 'Κωτσόβολος' }, warranty: { months: 24 }, attachments: [file('manual'), file('receipt')], paper: 'recycled' }, 3000);
const washer = mk({ name: 'Πλυντήριο ρούχων', brand: 'Bosch', model: 'WAU-28 PH9', category: 'laundry', room: 'Μπάνιο', purchase: { date: '2024-12-01' }, warranty: { months: 24 }, notes: 'Φίλτρο αντλίας κάθε 3 μήνες' }, 2000);
const drill = mk({ name: '', brand: 'Makita', model: 'DHP485', category: 'tools', room: 'Αποθήκη', purchase: { date: '2020-05-05' }, warranty: { months: 36 }, attachments: [file('manual')], ocrText: 'Cordless Hammer Driver Drill instruction manual' }, 1000);
const lamp = mk({ name: 'Φωτιστικό γραφείου', category: 'furniture', deleted: true }, 4000);
const idx = buildIndex([fridge, washer, drill, lamp]);
const TODAY = '2026-11-22';
const run = (query: string, filters: Filters = NO_FILTERS, sort: 'relevance' | 'recent' | 'name' | 'warranty' = 'relevance') =>
  search(idx, { query, filters, sort, today: TODAY }).map((i) => i.brand || i.name);

test('search: τόνοι, κεφαλαία, αρχή λέξης, λατινικά', () => {
  assert.deepEqual(run('ψυγειο'), ['Samsung']);
  assert.deepEqual(run('ΨΥΓ'), ['Samsung']);
  assert.deepEqual(run('psyg'), ['Samsung']);          // λατινικό πληκτρολόγιο
  assert.deepEqual(run('πλυντηριο bosch'), ['Bosch']); // όλες οι λέξεις (ΚΑΙ)
  assert.deepEqual(run('πλυντηριο samsung'), []);
  assert.deepEqual(run('κωτσοβολος'), ['Samsung']);    // κατάστημα
  assert.deepEqual(run('φιλτρο'), ['Bosch']);          // σημειώσεις
  assert.deepEqual(run('hammer'), ['Makita']);         // κείμενο εξωφύλλου (OCR)
  assert.deepEqual(run('εργαλεια'), ['Makita']);       // ετικέτα κατηγορίας
});

test('search: κωδικοί μοντέλου και λάθη πληκτρολόγησης', () => {
  assert.deepEqual(run('rb34t'), ['Samsung']);
  assert.deepEqual(run('wau28'), ['Bosch']);     // «WAU-28 PH9» χωρίς παύλα
  assert.deepEqual(run('wau 28ph9'), ['Bosch']);
  assert.deepEqual(run('632'), ['Samsung']);     // μέσα στον κωδικό
  assert.deepEqual(run('samsnug'), ['Samsung']); // αντιμετάθεση
  assert.deepEqual(run('makitta'), ['Makita']);
  assert.deepEqual(run('xyz'), []);
});

test('search: τα διαγραμμένα δεν εμφανίζονται, προεπιλογή τα πιο πρόσφατα', () => {
  assert.deepEqual(run(''), ['Samsung', 'Bosch', 'Makita']);
  assert.deepEqual(run('φωτιστικο'), []);
  assert.deepEqual(run('', NO_FILTERS, 'name'), ['Bosch', 'Samsung', 'Makita']); // ελληνική ταξινόμηση: Πλυντήριο, Ψυγειο…, μετά τα λατινικά (Makita DHP485)
});

test('search: φίλτρα και ταξινόμηση εγγύησης', () => {
  // σήμερα 22/11/2026: Bosch λήγει 1/12/2026 (σύντομα), Samsung 10/1/2027 (σύντομα), Makita έληξε 5/5/2023
  assert.deepEqual(run('', { ...NO_FILTERS, warranty: ['expiring'] }, 'warranty'), ['Bosch', 'Samsung']);
  assert.deepEqual(run('', { ...NO_FILTERS, warranty: ['expired'] }), ['Makita']);
  assert.deepEqual(run('', NO_FILTERS, 'warranty'), ['Bosch', 'Samsung', 'Makita']);
  assert.deepEqual(run('', { ...NO_FILTERS, manual: 'no' }), ['Bosch']);
  assert.deepEqual(run('', { ...NO_FILTERS, receipt: 'yes' }), ['Samsung']);
  assert.deepEqual(run('', { ...NO_FILTERS, paper: 'recycled' }), ['Samsung']);
  assert.deepEqual(run('', { ...NO_FILTERS, categories: ['kitchen', 'tools'] }), ['Samsung', 'Makita']); // Ή μέσα στην ομάδα
  assert.deepEqual(run('', { ...NO_FILTERS, categories: ['kitchen', 'tools'], manual: 'yes', rooms: ['Αποθήκη'] }), ['Makita']); // ΚΑΙ μεταξύ ομάδων
  assert.deepEqual(run('', { ...NO_FILTERS, tags: ['εντοιχιζόμενο'] }), ['Samsung']);
  assert.equal(activeFilterCount({ ...NO_FILTERS, categories: ['kitchen', 'tools'], manual: 'yes' }), 3);
});

test('facets: πλήθη ανά επιλογή, αγνοώντας τη δική της ομάδα', () => {
  const f = facets(idx, { query: '', filters: { ...NO_FILTERS, categories: ['kitchen'] }, today: TODAY });
  assert.equal(f.total, 1);
  assert.equal(f.categories.get('laundry'), 1); // η ομάδα «κατηγορία» δείχνει και τις άλλες επιλογές
  assert.deepEqual(f.manual, { yes: 1, no: 0 }); // οι άλλες ομάδες μετρούν μέσα στην Κουζίνα
  assert.equal(f.rooms.get('Κουζίνα'), 1);
  assert.equal(f.rooms.get('Μπάνιο'), undefined);
  const q = facets(idx, { query: 'bosch', filters: NO_FILTERS, today: TODAY });
  assert.equal(q.total, 1);
  assert.equal(q.warranty.get('expiring'), 1);
});
