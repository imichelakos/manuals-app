import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKey, importRawKey, isSealed, openBlob, openItem, sealBlob, sealItem } from '@/data/codec';
import { emptyItem } from '@/domain/model';

test('codec: προϊόν — κρυπτογράφηση και επαναφορά', async () => {
  const key = await generateKey();
  const item = { ...emptyItem(1), name: 'Πλυντήριο', notes: 'κωδικός WiFi: δεν μπαίνει εδώ' };
  const rec = await sealItem(key, item.id, item);
  assert.ok(isSealed(rec));
  assert.equal(rec.id, item.id);
  // στον δίσκο δεν φαίνεται τίποτα από το περιεχόμενο
  const raw = new TextDecoder().decode(rec.ct);
  assert.ok(!raw.includes('Πλυντήριο') && !raw.includes('name'));
  assert.deepEqual(await openItem(key, rec), item);
  // κάθε αποθήκευση έχει νέο IV
  const again = await sealItem(key, item.id, item);
  assert.notDeepEqual([...again.iv], [...rec.iv]);
});

test('codec: λάθος κλειδί, αλλαγμένα bytes ή μεταφορά σε άλλο id αποτυγχάνουν', async () => {
  const key = await generateKey(), other = await generateKey();
  const a = emptyItem(1), b = emptyItem(2);
  const rec = await sealItem(key, a.id, a);
  await assert.rejects(openItem(other, rec));
  await assert.rejects(openItem(key, { ...rec, id: b.id })); // AAD: δεν ανοίγει ως άλλο προϊόν
  const bad = new Uint8Array(rec.ct.slice(0)); bad[0]! ^= 1;
  await assert.rejects(openItem(key, { ...rec, ct: bad.buffer }));
});

test('codec: αρχείο με τύπο, και ο τύπος κρυπτογραφημένος', async () => {
  const key = await importRawKey(crypto.getRandomValues(new Uint8Array(32)));
  const blob = new Blob([new Uint8Array([37, 80, 68, 70, 45, 1, 2, 3])], { type: 'application/pdf' });
  const rec = await sealBlob(key, 'blob-aaaaaaaa', blob);
  assert.ok(isSealed(rec));
  assert.ok(!new TextDecoder().decode(rec.ct).includes('pdf'));
  const back = await openBlob(key, 'blob-aaaaaaaa', rec);
  assert.equal(back.type, 'application/pdf');
  assert.deepEqual([...new Uint8Array(await back.arrayBuffer())], [37, 80, 68, 70, 45, 1, 2, 3]);
  await assert.rejects(openBlob(key, 'blob-bbbbbbbb', rec));
  // χωρίς τύπο και άδειο
  const empty = await openBlob(key, 'x1234567', await sealBlob(key, 'x1234567', new Blob([])));
  assert.equal(empty.size, 0);
  assert.equal(empty.type, '');
});

test('codec: αναγνωρίζει τις παλιές απλές εγγραφές', () => {
  assert.equal(isSealed({ mime: 'image/jpeg', data: new ArrayBuffer(3) }), false);
  assert.equal(isSealed({ ...emptyItem(1) }), false);
  assert.equal(isSealed(null), false);
  assert.equal(isSealed({ iv: new Uint8Array(12), ct: new ArrayBuffer(16) }), true);
});
