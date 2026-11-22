/**
 * Υπενθυμίσεις λήξης εγγύησης: ΠΟΙΕΣ και ΠΟΤΕ. Καθαρός υπολογισμός από τα προϊόντα — το προγραμματισμό στη συσκευή τον
 * κάνει το services/notifications.
 *
 * Για κάθε ζωντανό προϊόν με εγγύηση που δεν έχει λήξει: μία υπενθύμιση `daysBefore` ημέρες πριν και μία την ημέρα της
 * λήξης, στις 10:00 τοπική ώρα. Όσες πέφτουν στο παρελθόν παραλείπονται. Κρατιούνται οι πιο κοντινές (`limit`): το iOS
 * έχει όριο στις προγραμματισμένες ειδοποιήσεις ανά εφαρμογή, και οι υπόλοιπες ξαναϋπολογίζονται σε κάθε αλλαγή.
 */
import { displayName, type Item } from './model';
import { addDays, type IsoDate } from './dates';
import { warrantyUntil } from './warranty';

export interface Reminder {
  /** σταθερό θετικό ακέραιο id (ίδιο για το ίδιο προϊόν και είδος) */
  id: number;
  itemId: string;
  kind: 'before' | 'day';
  /** ημερομηνία ειδοποίησης (ΕΕΕΕ-ΜΜ-ΗΗ, ώρα 10:00 τοπική) */
  date: IsoDate;
  /** για το κείμενο */
  name: string;
  until: IsoDate;
  daysLeft: number;
}

export const REMINDER_HOUR = 10;

/** FNV-1a 32 bit, περιορισμένο στο 1…2^31−1 (θετικό int για το plugin). */
export function reminderId(itemId: string, kind: Reminder['kind']): number {
  let h = 0x811c9dc5;
  for (const ch of `${itemId}:${kind}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return (h % 0x7ffffffe) + 1;
}

export function planReminders(items: Item[], o: { today: IsoDate; daysBefore: number; limit: number }): Reminder[] {
  const out: Reminder[] = [];
  for (const i of items) {
    if (i.deleted) continue;
    const until = warrantyUntil(i);
    if (!until || until < o.today) continue;
    const name = displayName(i);
    const before = addDays(until, -o.daysBefore);
    // «πριν»: μόνο αν είναι αυστηρά μετά από σήμερα (σήμερα στις 10:00 μπορεί να έχει ήδη περάσει)
    if (before && o.daysBefore > 0 && before > o.today) out.push({ id: reminderId(i.id, 'before'), itemId: i.id, kind: 'before', date: before, name, until, daysLeft: o.daysBefore });
    if (until > o.today) out.push({ id: reminderId(i.id, 'day'), itemId: i.id, kind: 'day', date: until, name, until, daysLeft: 0 });
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id)).slice(0, o.limit);
}
