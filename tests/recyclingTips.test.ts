import test from 'node:test';
import assert from 'node:assert/strict';
import { recyclingTips, regionFromLocales, sourceUrl } from '@/domain/recyclingTips';

const ids = (...a: Parameters<typeof recyclingTips>) => recyclingTips(...a).map((t) => t.id);

test('regionFromLocales: Ελλάδα / ΕΕ / υπόλοιπος κόσμος', () => {
  assert.equal(regionFromLocales(['el-GR', 'en-GB']), 'gr');
  assert.equal(regionFromLocales(['el']), 'gr');
  assert.equal(regionFromLocales(['de-AT']), 'eu');
  assert.equal(regionFromLocales(['en-US', 'el-GR']), 'world'); // η πρώτη περιοχή μετρά
  assert.equal(regionFromLocales(['en']), 'world');
});

test('recyclingTips: ανά περιοχή, ομάδα και είδος', () => {
  const fridge = { name: 'Ψυγειοκαταψύκτης', category: 'kitchen' as const, group: 'large' as const };
  const gr = ids(fridge, 'gr');
  assert.ok(gr.includes('cooling') && gr.includes('oneToOne') && gr.includes('grPoints') && gr.includes('grBatteries'));
  assert.ok(!gr.includes('smallZeroToOne'));                // μεγάλη συσκευή: όχι ο κανόνας των 25 cm
  const phone = ids({ name: 'Κινητό', category: 'computing', group: 'electronics' }, 'eu');
  assert.ok(phone.includes('data') && phone.includes('smallZeroToOne') && !phone.includes('grPoints'));
  const us = ids({ name: 'Laptop', category: 'computing', group: 'electronics' }, 'world');
  assert.ok(us.includes('worldTakeBack') && !us.includes('oneToOne') && !us.includes('symbol'));
  assert.deepEqual(ids({ name: 'Ντουλάπα', category: 'furniture', group: 'unpowered' }, 'gr'), ['reuse', 'unpowered']);
  assert.ok(ids({ name: 'Λάμπα LED', category: 'other', group: 'small' }, 'eu').includes('lamps'));
  // κάθε συμβουλή με ισχυρισμό για υποχρέωση έχει πηγή
  for (const t of recyclingTips(fridge, 'gr')) if (t.id !== 'reuse') assert.ok(t.source, t.id);
  assert.ok(sourceUrl('art5', 'en').includes('/EN/') && sourceUrl('art5', 'el').includes('/EL/'));
});
