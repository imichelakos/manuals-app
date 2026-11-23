import test from 'node:test';
import assert from 'node:assert/strict';
import { planReminders, reminderId } from '@/domain/reminders';
import { addDays } from '@/domain/dates';
import { emptyItem, type Item } from '@/domain/model';

const mk = (p: Partial<Item>): Item => ({ ...emptyItem(1), ...p });
const TODAY = '2026-11-22';

test('dates: addDays', () => {
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('άκυρο', 1), null);
});

test('reminders: πριν και την ημέρα της λήξης, ταξινομημένες, χωρίς παρελθόν', () => {
  const far = mk({ name: 'Πλυντήριο', purchase: { date: '2025-03-14' }, warranty: { months: 24 } }); // λήγει 2027-03-14
  const soon = mk({ name: 'Ψυγείο', warranty: { until: '2026-12-01' } });                            // πριν: 2026-11-01 (παρελθόν)
  const expired = mk({ name: 'Δράπανο', warranty: { until: '2026-01-01' } });
  const none = mk({ name: 'Χωρίς εγγύηση' });
  const deleted = mk({ deleted: true, warranty: { until: '2027-01-01' } });
  const r = planReminders([far, soon, expired, none, deleted], { today: TODAY, daysBefore: 30, limit: 50 });
  assert.deepEqual(r.map((x) => [x.name, x.kind, x.date]), [
    ['Ψυγείο', 'day', '2026-12-01'],
    ['Πλυντήριο', 'before', '2027-02-12'],
    ['Πλυντήριο', 'day', '2027-03-14'],
  ]);
});

test('reminders: σήμερα δεν προγραμματίζεται (μπορεί να έχει περάσει η ώρα), όριο πλήθους', () => {
  const today = mk({ warranty: { until: TODAY } });
  const tomorrowBefore = mk({ warranty: { until: '2026-12-23' } }); // πριν = 2026-11-23
  assert.deepEqual(planReminders([today], { today: TODAY, daysBefore: 30, limit: 50 }), []);
  assert.equal(planReminders([tomorrowBefore], { today: TODAY, daysBefore: 30, limit: 50 })[0]!.date, '2026-11-23');
  const many = Array.from({ length: 40 }, (_, k) => mk({ warranty: { until: addDays('2027-01-01', k)! } }));
  const r = planReminders(many, { today: TODAY, daysBefore: 30, limit: 50 });
  assert.equal(r.length, 50);
  assert.ok(r.every((x, i) => i === 0 || r[i - 1]!.date <= x.date));
});

test('reminders: σταθερά, θετικά, διαφορετικά id', () => {
  const a = reminderId('abc', 'before'), b = reminderId('abc', 'day');
  assert.equal(a, reminderId('abc', 'before'));
  assert.notEqual(a, b);
  for (const v of [a, b, reminderId('', 'day')]) assert.ok(Number.isInteger(v) && v >= 1 && v <= 0x7fffffff);
});
