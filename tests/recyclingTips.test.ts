import test from 'node:test';
import assert from 'node:assert/strict';
import { recyclingTips, sourceUrl } from '@/domain/recyclingTips';

const ids = (name: string, group: Parameters<typeof recyclingTips>[0]['group']) => recyclingTips({ name, group }).map((t) => t.id);

test('recyclingTips: γενικές, ανά ομάδα και είδος', () => {
  const fridge = ids('Ψυγειοκαταψύκτης', 'large');
  assert.ok(fridge.includes('cooling') && fridge.includes('symbol') && fridge.includes('takeBack') && !fridge.includes('data'));
  assert.ok(ids('Κινητό', 'electronics').includes('data'));
  assert.ok(ids('Λάμπα LED', 'small').includes('lamps'));
  assert.deepEqual(ids('Ντουλάπα', 'unpowered'), ['reuse', 'unpowered']);
  // κάθε συμβουλή εκτός από τις γενικές «επαναχρησιμοποίηση/χωρίς ρεύμα» έχει πηγή
  for (const t of recyclingTips({ name: 'Ψυγείο', group: 'large' })) assert.ok(t.source, t.id);
  assert.ok(sourceUrl('annex7', 'en').includes('/EN/') && sourceUrl('annex7', 'el').includes('/EL/'));
});
