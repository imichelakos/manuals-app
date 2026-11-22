/**
 * Συγχώνευση δύο συνόλων προϊόντων (αυτή η συσκευή + ένα εισερχόμενο: αντίγραφο ασφαλείας ή άλλη συσκευή).
 * Κανόνας: ανά προϊόν κερδίζει η πιο πρόσφατη αλλαγή (updatedAt). Σε ισοπαλία χρόνου με διαφορετικό περιεχόμενο κερδίζει
 * πάντα η ίδια εκδοχή σε κάθε συσκευή (σύγκριση του περιεχομένου), ώστε δύο συσκευές να καταλήγουν στο ίδιο αποτέλεσμα
 * με όποια σειρά κι αν συγχωνεύσουν. Οι διαγραφές ταξιδεύουν ως «ταφόπλακες» (deleted), άρα μια διαγραφή δεν
 * «ανασταίνεται» από παλιότερο αντίγραφο. Τον ίδιο κανόνα χρησιμοποιεί ο αυτόματος συγχρονισμός (data/syncEngine).
 */
import type { Item } from './model';

export interface MergeResult { items: Item[]; added: number; updated: number; kept: number }

/** Σταθερή μορφή ενός προϊόντος για σύγκριση: JSON με τα κλειδιά ταξινομημένα, ανεξάρτητα από τη σειρά που γράφτηκαν. */
const canonical = (v: unknown): string =>
  Array.isArray(v) ? `[${v.map(canonical).join(',')}]`
    : v && typeof v === 'object' ? `{${Object.entries(v).filter(([, x]) => x !== undefined).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => `${JSON.stringify(k)}:${canonical(x)}`).join(',')}}`
    : JSON.stringify(v);
const fingerprint = (i: Item) => canonical(i);
export const sameItem = (a: Item, b: Item): boolean => a.updatedAt === b.updatedAt && fingerprint(a) === fingerprint(b);

/** Κερδίζει το `a` απέναντι στο `b`; Νεότερη αλλαγή, και σε ισοπαλία χρόνου το «μεγαλύτερο» περιεχόμενο. */
export const wins = (a: Item, b: Item): boolean =>
  a.updatedAt !== b.updatedAt ? a.updatedAt > b.updatedAt : fingerprint(a) > fingerprint(b);

export function mergeItems(local: Item[], incoming: Item[]): MergeResult {
  const byId = new Map(local.map((i) => [i.id, i]));
  let added = 0, updated = 0, kept = 0;
  for (const inc of incoming) {
    const cur = byId.get(inc.id);
    if (!cur) { byId.set(inc.id, inc); if (!inc.deleted) added++; }
    else if (wins(inc, cur)) { byId.set(inc.id, inc); updated++; }
    else kept++;
  }
  return { items: [...byId.values()], added, updated, kept };
}

/** Τύπος (MIME) κάθε αρχείου που αναφέρουν τα προϊόντα — τα bytes ταξιδεύουν χωρίς τύπο, ο τύπος είναι στα στοιχεία. */
export function blobMimes(items: Item[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const i of items) for (const a of i.attachments) { m.set(a.blobId, a.mime); if (a.thumbId) m.set(a.thumbId, 'image/jpeg'); }
  return m;
}

/** Αναγνωριστικά αρχείων (blobs) που χρησιμοποιούν τα ζωντανά προϊόντα — ό,τι άλλο υπάρχει στην αποθήκη είναι ορφανό. */
export function referencedBlobs(items: Item[]): Set<string> {
  const ids = new Set<string>();
  for (const i of items) if (!i.deleted) for (const a of i.attachments) { ids.add(a.blobId); if (a.thumbId) ids.add(a.thumbId); }
  return ids;
}
