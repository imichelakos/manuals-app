/**
 * Υπενθυμίσεις λήξης εγγύησης: ΠΟΙΕΣ και ΠΟΤΕ. Καθαρός υπολογισμός από τα προϊόντα — το προγραμματισμό στη συσκευή τον
 * κάνει το services/notifications.
 *
 * Για κάθε ζωντανό προϊόν με εγγύηση που δεν έχει λήξει: μία υπενθύμιση για κάθε τιμή του `daysBefore` (έως
 * MAX_REMINDER_OFFSETS, π.χ. 60, 30 και 7 ημέρες πριν) και μία την ημέρα της λήξης, στις 10:00 τοπική ώρα. Το ίδιο και για
 * κάθε μέρος με δική του εγγύηση (warranty.parts), με το όνομα του μέρους. Όσες πέφτουν στο παρελθόν παραλείπονται. Κρατιούνται οι πιο κοντινές (`limit`): το iOS
 * έχει όριο στις προγραμματισμένες ειδοποιήσεις ανά εφαρμογή, και οι υπόλοιπες ξαναϋπολογίζονται σε κάθε αλλαγή.
 */
import { displayName, type Item } from './model';
import { addDays, type IsoDate } from './dates';
import { partUntil, warrantyUntil } from './warranty';

export interface Reminder {
  /** σταθερό θετικό ακέραιο id (ίδιο για το ίδιο προϊόν και είδος) */
  id: number;
  itemId: string;
  kind: 'before' | 'day';
  /** ημερομηνία ειδοποίησης (ΕΕΕΕ-ΜΜ-ΗΗ, ώρα 10:00 τοπική) */
  date: IsoDate;
  /** για το κείμενο: το όνομα του προϊόντος (με το μέρος μπροστά, για εγγύηση μέρους) */
  name: string;
  /** εγγύηση μέρους: το id και το όνομά του */
  partId?: string;
  part?: string;
  until: IsoDate;
  daysLeft: number;
}

export const REMINDER_HOUR = 10;
/** πόσες «πριν» υπενθυμίσεις μπορεί να διαλέξει ο χρήστης */
export const MAX_REMINDER_OFFSETS = 5;

/** Οι ημέρες «πριν» καθαρές: ακέραιες 1…99, χωρίς διπλές, φθίνουσες (πιο νωρίς πρώτα), έως MAX_REMINDER_OFFSETS. */
export function normalizeOffsets(v: unknown): number[] {
  const list = (Array.isArray(v) ? v : [v]).filter((n): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 99);
  return [...new Set(list)].sort((a, b) => b - a).slice(0, MAX_REMINDER_OFFSETS);
}

/**
 * FNV-1a 32 bit, περιορισμένο στο 1…2^31−1 (θετικό int για το plugin). `days`: για τις «πριν» (μία ανά πλήθος ημερών).
 * `partId`: για εγγύηση μέρους (η κύρια εγγύηση κρατά τα ίδια id με πριν).
 */
export function reminderId(itemId: string, kind: Reminder['kind'], days = 0, partId?: string): number {
  let h = 0x811c9dc5;
  const base = kind === 'before' ? `${itemId}:before:${days}` : `${itemId}:${kind}`;
  for (const ch of partId ? `${base}:part:${partId}` : base) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return (h % 0x7ffffffe) + 1;
}

/** Οι εγγυήσεις ενός προϊόντος: η κύρια και όσες έχουν τα μέρη του, με τη λήξη και το όνομα για το κείμενο. */
interface Coverage { until: IsoDate; name: string; partId?: string; part?: string }
function coverages(i: Item): Coverage[] {
  const name = displayName(i);
  const out: Coverage[] = [];
  const main = warrantyUntil(i);
  if (main) out.push({ until: main, name });
  for (const p of i.warranty.parts ?? []) {
    const until = partUntil(i, p);
    if (until) out.push({ until, name: p.name ? `${p.name} — ${name}` : name, partId: p.id, part: p.name });
  }
  return out;
}

export function planReminders(items: Item[], o: { today: IsoDate; daysBefore: number[]; limit: number }): Reminder[] {
  const out: Reminder[] = [];
  for (const i of items) {
    if (i.deleted) continue;
    for (const c of coverages(i)) {
      const { until, name, partId, part } = c;
      if (until < o.today) continue;
      for (const days of normalizeOffsets(o.daysBefore)) {
        const before = addDays(until, -days);
        // «πριν»: μόνο αν είναι αυστηρά μετά από σήμερα (σήμερα στις 10:00 μπορεί να έχει ήδη περάσει)
        if (before && before > o.today) out.push({ id: reminderId(i.id, 'before', days, partId), itemId: i.id, kind: 'before', date: before, name, until, daysLeft: days, partId, part });
      }
      if (until > o.today) out.push({ id: reminderId(i.id, 'day', 0, partId), itemId: i.id, kind: 'day', date: until, name, until, daysLeft: 0, partId, part });
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id)).slice(0, o.limit);
}

/**
 * Ειδοποιήσεις που έχουν ήδη «χτυπήσει» (ημερομηνία ≤ σήμερα), για τη λίστα ειδοποιήσεων της εφαρμογής: κρατιούνται μέχρι
 * να τις σβήσει ο χρήστης, ακόμη κι αφού λήξει η εγγύηση (έως `lookbackDays` πίσω). Το κλειδί αλλάζει όταν αλλάξει η
 * ημερομηνία λήξης, ώστε μια νέα λήξη να φέρει νέα ειδοποίηση. Νεότερες πρώτα.
 */
export interface DueReminder extends Reminder { key: string }

export function dueReminders(items: Item[], o: { today: IsoDate; daysBefore: number[]; lookbackDays: number }): DueReminder[] {
  const oldest = addDays(o.today, -o.lookbackDays);
  if (!oldest) return [];
  const out: DueReminder[] = [];
  for (const i of items) {
    if (i.deleted) continue;
    for (const { until, name, partId, part } of coverages(i)) {
      const scope = partId ? `${i.id}:part:${partId}` : i.id;
      const add = (kind: Reminder['kind'], date: IsoDate | null, daysLeft: number) => {
        if (!date || date > o.today || date < oldest) return;
        out.push({ id: reminderId(i.id, kind, daysLeft, partId), key: kind === 'before' ? `${scope}:before:${daysLeft}:${until}` : `${scope}:day:${until}`, itemId: i.id, kind, date, name, until, daysLeft, partId, part });
      };
      // οι «νωρίτερες» έχουν νόημα μόνο μέχρι να λήξει η εγγύηση· μετά μένει μόνο αυτή της ημέρας λήξης. Από τις «πριν»
      // που έχουν ήδη χτυπήσει κρατιέται μόνο η πιο πρόσφατη: οι παλαιότερες λένε το ίδιο με λιγότερη ακρίβεια.
      if (until > o.today) {
        const fired = normalizeOffsets(o.daysBefore).filter((d) => { const b = addDays(until, -d); return !!b && b <= o.today; });
        const latest = fired.length ? Math.min(...fired) : null;
        if (latest !== null) add('before', addDays(until, -latest), latest);
      }
      add('day', until, 0);
    }
  }
  return out.sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : a.id - b.id));
}
