/**
 * Τοπικές ειδοποιήσεις στη συσκευή (iOS), μέσω του @capacitor/local-notifications. Χωρίς server: το iOS τις εμφανίζει
 * την ώρα τους ακόμη κι αν η εφαρμογή είναι κλειστή. Στο web δεν υπάρχουν: οι συναρτήσεις δεν κάνουν τίποτα.
 * ΣΗΜ.: δεν έχει δοκιμαστεί ακόμη σε συσκευή ή simulator.
 */
import { Capacitor } from '@capacitor/core';
import { expectAppSwitch } from './appSwitch';

export const notificationsSupported = Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LocalNotifications');

export interface DeviceNotification { id: number; title: string; body: string; at: Date; extra: Record<string, string> }

// ΠΡΟΣΟΧΗ: το plugin είναι Proxy του Capacitor που «απαντά» σε κάθε όνομα, και στο `then`. Αν επιστραφεί ΜΕΣΑ από Promise
// (π.χ. `.then((m) => m.LocalNotifications)`), η JavaScript το περνά για thenable, καλεί μια ανύπαρκτη native μέθοδο `then`
// και η αναμονή δεν τελειώνει ποτέ — έτσι ο διακόπτης υπενθυμίσεων «δεν άνοιγε» (23/11/2026). Επιστρέφεται το module.
const mod = () => import('@capacitor/local-notifications');

/** Ζητά άδεια (μία φορά το iOS ρωτά τον χρήστη· μετά απαντά από μνήμης). true αν επιτρέπεται. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!notificationsSupported) return false;
  try {
    const p = (await mod()).LocalNotifications;
    const cur = await p.checkPermissions();
    if (cur.display === 'granted') return true;
    expectAppSwitch(); // το ερώτημα άδειας του iOS
    return (await p.requestPermissions()).display === 'granted';
  } catch { return false; }
}

export async function notificationPermissionGranted(): Promise<boolean> {
  if (!notificationsSupported) return false;
  try { return (await (await mod()).LocalNotifications.checkPermissions()).display === 'granted'; } catch { return false; }
}

/**
 * Αντικαθιστά ΟΛΕΣ τις προγραμματισμένες ειδοποιήσεις της εφαρμογής με τη νέα λίστα (η εφαρμογή δεν έχει άλλες).
 * Δεν ζητά άδεια: χωρίς άδεια δεν προγραμματίζει τίποτα.
 */
export async function replaceScheduled(list: DeviceNotification[]): Promise<void> {
  if (!notificationsSupported || !(await notificationPermissionGranted())) return;
  const p = (await mod()).LocalNotifications;
  const pending = await p.getPending();
  if (pending.notifications.length) await p.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  if (list.length) await p.schedule({ notifications: list.map((n) => ({ id: n.id, title: n.title, body: n.body, schedule: { at: n.at }, extra: n.extra })) });
}

export async function cancelAllScheduled(): Promise<void> {
  if (!notificationsSupported) return;
  try {
    const p = (await mod()).LocalNotifications;
    const pending = await p.getPending();
    if (pending.notifications.length) await p.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  } catch { /* τίποτα να ακυρωθεί */ }
}

/** Πάτημα σε ειδοποίηση → callback με τα extra της (π.χ. για άνοιγμα της καρτέλας του προϊόντος). */
export async function onNotificationTap(fn: (extra: Record<string, unknown>) => void): Promise<void> {
  if (!notificationsSupported) return;
  const p = (await mod()).LocalNotifications;
  await p.addListener('localNotificationActionPerformed', (a) => fn((a.notification.extra ?? {}) as Record<string, unknown>));
}
