/**
 * Συγχώνευση δύο συνόλων προϊόντων (αυτή η συσκευή + ένα εισερχόμενο: αντίγραφο ασφαλείας ή άλλη συσκευή).
 * Κανόνας: ανά προϊόν κερδίζει η πιο πρόσφατη αλλαγή (updatedAt)· σε ισοπαλία μένει το τοπικό. Οι διαγραφές ταξιδεύουν ως
 * «ταφόπλακες» (deleted), άρα μια διαγραφή δεν «ανασταίνεται» από παλιότερο αντίγραφο. Ο ίδιος κανόνας θα χρησιμοποιηθεί
 * και από τον αυτόματο συγχρονισμό.
 */
import type { Item } from './model';

export interface MergeResult { items: Item[]; added: number; updated: number; kept: number }

export function mergeItems(local: Item[], incoming: Item[]): MergeResult {
  const byId = new Map(local.map((i) => [i.id, i]));
  let added = 0, updated = 0, kept = 0;
  for (const inc of incoming) {
    const cur = byId.get(inc.id);
    if (!cur) { byId.set(inc.id, inc); if (!inc.deleted) added++; }
    else if (inc.updatedAt > cur.updatedAt) { byId.set(inc.id, inc); updated++; }
    else kept++;
  }
  return { items: [...byId.values()], added, updated, kept };
}

/** Αναγνωριστικά αρχείων (blobs) που χρησιμοποιούν τα ζωντανά προϊόντα — ό,τι άλλο υπάρχει στην αποθήκη είναι ορφανό. */
export function referencedBlobs(items: Item[]): Set<string> {
  const ids = new Set<string>();
  for (const i of items) if (!i.deleted) for (const a of i.attachments) { ids.add(a.blobId); if (a.thumbId) ids.add(a.thumbId); }
  return ids;
}
