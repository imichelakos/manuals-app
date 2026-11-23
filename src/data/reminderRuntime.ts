/**
 * Υπενθυμίσεις λήξης εγγύησης «εν ώρα λειτουργίας»: όταν είναι ανοιχτές στις Ρυθμίσεις, ξαναϋπολογίζει (domain/reminders)
 * και ξαναπρογραμματίζει τις ειδοποιήσεις της συσκευής στην εκκίνηση, μετά από κάθε αλλαγή της βιβλιοθήκης και όταν
 * η εφαρμογή ξαναέρχεται μπροστά (για να κυλά το «σήμερα» και να ανανεώνονται όσες ξεπέρασαν το όριο πλήθους).
 */
import { planReminders, REMINDER_HOUR, type Reminder } from '@/domain/reminders';
import { parseIso, today } from '@/domain/dates';
import { cancelAllScheduled, notificationsSupported, onNotificationTap, replaceScheduled, requestNotificationPermission, type DeviceNotification } from '@/services/notifications';
import { fmtDate, t, tn } from '@/i18n';
import { allItems, onLibraryChange } from './library';
import { getSettings, setSettings } from './settings';

/** Όριο πλήθους: το iOS κρατά περιορισμένο αριθμό προγραμματισμένων ειδοποιήσεων ανά εφαρμογή· μένουμε με περιθώριο. */
const LIMIT = 50;

export const remindersSupported = notificationsSupported;

/** Τίτλος και κείμενο μιας υπενθύμισης — ίδια στην ειδοποίηση της συσκευής και στη λίστα ειδοποιήσεων της εφαρμογής. */
export function reminderMessage(r: Reminder): { title: string; body: string } {
  const name = r.name || t('ένα προϊόν');
  return {
    title: r.kind === 'day' ? t('Η εγγύηση λήγει σήμερα') : tn(r.daysLeft, 'Η εγγύηση λήγει σε {n} ημέρα', 'Η εγγύηση λήγει σε {n} ημέρες'),
    body: t('«{name}» — έως {date}. Έχεις το παραστατικό αγοράς;', { name, date: fmtDate(r.until) }),
  };
}

function toNotification(r: Reminder): DeviceNotification | null {
  const d = parseIso(r.date);
  if (!d) return null;
  return {
    id: r.id,
    ...reminderMessage(r),
    at: new Date(d.y, d.m - 1, d.d, REMINDER_HOUR, 0, 0),
    extra: { itemId: r.itemId },
  };
}

let timer: ReturnType<typeof setTimeout> | undefined;
let running: Promise<void> = Promise.resolve();

/** Ξαναπρογραμματίζει τώρα (σειριακά: ένας προγραμματισμός τη φορά). */
export function rescheduleReminders(): Promise<void> {
  const run = async () => {
    const s = getSettings();
    if (!s.reminders) { await cancelAllScheduled(); return; }
    const list = planReminders(allItems(), { today: today(), daysBefore: s.reminderDays, limit: LIMIT }).flatMap((r) => toNotification(r) ?? []);
    await replaceScheduled(list).catch(() => { /* αποτυχία: ξαναδοκιμάζεται στην επόμενη αλλαγή */ });
  };
  running = running.then(run, run);
  return running;
}

/** Άνοιγμα/κλείσιμο από τις Ρυθμίσεις. Στο άνοιγμα ζητά άδεια· χωρίς άδεια μένει κλειστό. Επιστρέφει αν άνοιξε. */
export async function setRemindersEnabled(on: boolean): Promise<boolean> {
  if (on && !(await requestNotificationPermission())) { setSettings({ reminders: false }); return false; }
  setSettings({ reminders: on });
  await rescheduleReminders();
  return on;
}

/** Εκκίνηση (μία φορά, μετά τη φόρτωση της βιβλιοθήκης). `openItem`: τι κάνει το πάτημα σε ειδοποίηση. */
export function startReminders(openItem: (id: string) => void): void {
  if (!remindersSupported) return;
  void onNotificationTap((extra) => { if (typeof extra.itemId === 'string') openItem(extra.itemId); });
  void rescheduleReminders();
  onLibraryChange(() => { clearTimeout(timer); timer = setTimeout(() => void rescheduleReminders(), 3000); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void rescheduleReminders(); });
}
