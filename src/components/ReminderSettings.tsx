/** Ρυθμίσεις → Υπενθυμίσεις: ειδοποίηση στη συσκευή πριν λήξει μια εγγύηση (μόνο στην εφαρμογή iOS). */
import { useState } from 'react';
import { REMINDER_DAY_OPTIONS, setSettings, useSettings } from '@/data/settings';
import { remindersSupported, rescheduleReminders, setRemindersEnabled } from '@/data/reminderRuntime';
import { t, tn } from '@/i18n';

export function ReminderSettings() {
  const { reminders, reminderDays } = useSettings();
  const [denied, setDenied] = useState(false);
  if (!remindersSupported) {
    return <p className="text-[15px] leading-relaxed text-ink-2">{t('Οι υπενθυμίσεις λήξης εγγύησης λειτουργούν στην εφαρμογή για iPhone και iPad.')}</p>;
  }
  const toggle = async () => setDenied(!(await setRemindersEnabled(!reminders)) && !reminders);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button type="button" role="switch" aria-checked={reminders} aria-label={t('Υπενθύμιση λήξης εγγύησης')} onClick={() => void toggle()}
          className={`relative h-8 w-14 shrink-0 rounded-full transition ${reminders ? 'bg-ok' : 'bg-surface-2'}`}>
          <span className={`absolute top-1 size-6 rounded-full bg-surface shadow-card transition-all ${reminders ? 'left-7' : 'left-1'}`} />
        </button>
        <p className="text-[15px] font-semibold">{reminders ? t('Ανοιχτές') : t('Κλειστές')}</p>
      </div>
      {denied && <p className="rounded-2xl bg-warn-soft p-3 text-[14px] leading-relaxed text-warn">{t('Οι ειδοποιήσεις δεν επιτρέπονται για την εφαρμογή. Άνοιξέ τες από τις Ρυθμίσεις της συσκευής → Ειδοποιήσεις.')}</p>}
      {reminders && (
        <div role="radiogroup" aria-label={t('Πόσο νωρίς')} className="inline-flex flex-wrap gap-1 rounded-2xl bg-surface-2 p-1">
          {REMINDER_DAY_OPTIONS.map((d) => (
            <button key={d} type="button" role="radio" aria-checked={reminderDays === d}
              onClick={() => { setSettings({ reminderDays: d }); void rescheduleReminders(); }}
              className={`min-h-10 rounded-xl px-4 text-sm font-semibold transition ${reminderDays === d ? 'bg-surface text-ink shadow-card' : 'text-ink-2'}`}>
              {tn(d, '{n} ημέρα πριν', '{n} ημέρες πριν')}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
