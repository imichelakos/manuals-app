/**
 * Ρυθμίσεις → Υπενθυμίσεις: ειδοποιήσεις στη συσκευή πριν λήξει μια εγγύηση (μόνο στην εφαρμογή iOS). Πολλαπλή επιλογή
 * «πόσο νωρίς» (έως MAX_REMINDER_OFFSETS)· η ειδοποίηση της ημέρας λήξης στέλνεται πάντα.
 */
import { useState } from 'react';
import { REMINDER_DAY_OPTIONS, REMINDER_DAYS_MAX, setSettings, useSettings } from '@/data/settings';
import { MAX_REMINDER_OFFSETS, normalizeOffsets } from '@/domain/reminders';
import { OtherNumber } from '@/components/controls';
import { remindersSupported, rescheduleReminders, setRemindersEnabled } from '@/data/reminderRuntime';
import { t, tn } from '@/i18n';

export function ReminderSettings() {
  const { reminders, reminderDays } = useSettings();
  const [denied, setDenied] = useState(false);
  if (!remindersSupported) {
    return <p className="text-[15px] leading-relaxed text-ink-2">{t('Οι υπενθυμίσεις λήξης εγγύησης λειτουργούν στην εφαρμογή για iPhone και iPad.')}</p>;
  }
  const save = (days: number[]) => { setSettings({ reminderDays: normalizeOffsets(days) }); void rescheduleReminders(); };
  const toggleDay = (d: number) => save(reminderDays.includes(d) ? reminderDays.filter((x) => x !== d) : [...reminderDays, d]);
  const full = reminderDays.length >= MAX_REMINDER_OFFSETS;
  // chips: οι έτοιμες επιλογές + όσες πρόσθεσε ο χρήστης με το «Άλλο», από τη νωρίτερη στην πιο κοντινή
  const chips = [...new Set([...REMINDER_DAY_OPTIONS, ...reminderDays])].sort((a, b) => b - a);
  const toggle = async () => setDenied(!(await setRemindersEnabled(!reminders)) && !reminders);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button type="button" role="switch" aria-checked={reminders} aria-label={t('Υπενθύμιση λήξης εγγύησης')} onClick={() => void toggle()}
          className={`relative h-8 w-14 shrink-0 rounded-full transition ${reminders ? 'bg-ok' : 'bg-surface-2'}`}>
          <span className={`absolute top-1 size-6 rounded-full bg-surface shadow-card transition-all ${reminders ? 'left-7' : 'left-1'}`} />
        </button>
      </div>
      {denied && <p className="rounded-2xl bg-warn-soft p-3 text-[14px] leading-relaxed text-warn">{t('Οι ειδοποιήσεις δεν επιτρέπονται για την εφαρμογή. Άνοιξέ τες από τις Ρυθμίσεις της συσκευής → Ειδοποιήσεις.')}</p>}
      {reminders && (
        <fieldset>
          <legend className="mb-2 text-[13px] text-ink-2">{t('Πόσο νωρίς (έως {n}) — και πάντα την ημέρα της λήξης', { n: MAX_REMINDER_OFFSETS })}</legend>
          <div className="flex flex-wrap gap-2">
            {chips.map((d) => {
              const on = reminderDays.includes(d);
              return (
                <button key={d} type="button" aria-pressed={on} disabled={!on && full} onClick={() => toggleDay(d)}
                  className={`chip disabled:opacity-40 ${on ? 'chip-on' : ''}`}>{tn(d, '{n} ημέρα πριν', '{n} ημέρες πριν')}</button>
              );
            })}
            {!full && (
              <label className="chip gap-2 pr-2">
                <span>{t('Άλλο')}</span>
                <OtherNumber value={undefined} presets={chips} min={1} max={REMINDER_DAYS_MAX}
                  onChange={(n) => { if (n !== undefined) save([...reminderDays, n]); }}
                  className="w-14 rounded-lg bg-surface-2 px-2 py-1 text-center text-base text-ink outline-hidden"
                  label={t('Ημέρες πριν από τη λήξη')} placeholder={t('ημέρες')} />
              </label>
            )}
          </div>
        </fieldset>
      )}
    </div>
  );
}
