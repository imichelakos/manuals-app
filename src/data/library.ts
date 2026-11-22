/**
 * Η βιβλιοθήκη: όλα τα προϊόντα στη μνήμη (για άμεση αναζήτηση) + μόνιμη αποθήκευση στο IndexedDB.
 * Μοναδικό σημείο που αλλάζει προϊόντα: κάθε αλλαγή παίρνει νέο updatedAt (η βάση της συγχώνευσης/συγχρονισμού) και
 * ειδοποιεί την οθόνη. Τα διαγραμμένα μένουν ως «ταφόπλακες» χωρίς περιεχόμενο.
 */
import { useSyncExternalStore } from 'react';
import { emptyItem, itemSchema, type Item } from '@/domain/model';
import { mergeItems, referencedBlobs, type MergeResult } from '@/domain/merge';
import * as idb from './idb';
import { blobStore } from './blobs';

let all: Item[] = [];
let live: Item[] = [];
let ready = false;
const listeners = new Set<() => void>();

function set(next: Item[]) {
  all = next;
  live = next.filter((i) => !i.deleted);
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
/** Ειδοποίηση σε κάθε αλλαγή της βιβλιοθήκης (π.χ. για να ξεκινήσει συγχρονισμός). */
export const onLibraryChange = subscribe;

/** Φόρτωση από τον δίσκο (μία φορά, πριν εμφανιστεί η εφαρμογή). Εγγραφές που δεν περνούν το σχήμα αγνοούνται. */
export async function loadLibrary(): Promise<void> {
  const raw = await idb.getAll<unknown>('items');
  set(raw.flatMap((r) => { const p = itemSchema.safeParse(r); return p.success ? [p.data] : []; }));
  ready = true;
}
export const isReady = () => ready;

/** Τα ζωντανά προϊόντα (χωρίς διαγραμμένα). */
export const useItems = (): Item[] => useSyncExternalStore(subscribe, () => live);
export const useItem = (id: string | undefined): Item | undefined => useItems().find((i) => i.id === id);
export const getItem = (id: string): Item | undefined => live.find((i) => i.id === id);
export const allItems = (): Item[] => all;

/** Αποθήκευση νέου ή αλλαγμένου προϊόντος. */
export async function saveItem(item: Item): Promise<Item> {
  const next = itemSchema.parse({ ...item, updatedAt: Date.now() });
  await idb.write('items', { put: [{ value: next }] });
  set(all.some((i) => i.id === next.id) ? all.map((i) => (i.id === next.id ? next : i)) : [...all, next]);
  return next;
}

/** Αλλαγή πεδίων υπάρχοντος προϊόντος. */
export async function updateItem(id: string, patch: (cur: Item) => Item): Promise<Item | undefined> {
  const cur = getItem(id);
  return cur ? saveItem(patch(cur)) : undefined;
}

/** Διαγραφή: το προϊόν γίνεται ταφόπλακα (χωρίς στοιχεία) και τα αρχεία του σβήνονται από τη συσκευή. */
export async function deleteItem(id: string): Promise<void> {
  const cur = getItem(id);
  if (!cur) return;
  const tomb: Item = { ...emptyItem(cur.createdAt), id: cur.id, deleted: true, updatedAt: Date.now() };
  await idb.write('items', { put: [{ value: tomb }] });
  set(all.map((i) => (i.id === id ? tomb : i)));
  await blobStore.remove(cur.attachments.flatMap((a) => (a.thumbId ? [a.blobId, a.thumbId] : [a.blobId])));
}

/** Συγχώνευση εισερχόμενων προϊόντων (αντίγραφο ασφαλείας / άλλη συσκευή) με τον κανόνα του domain/merge. */
export async function mergeIn(incoming: Item[]): Promise<MergeResult> {
  const r = mergeItems(all, incoming);
  const changed = r.items.filter((i) => all.find((x) => x.id === i.id) !== i);
  await idb.write('items', { put: changed.map((value) => ({ value })) });
  set(r.items);
  await pruneBlobs();
  return r;
}

/** Σβήνει αρχεία που δεν ανήκουν πια σε κανένα προϊόν (π.χ. μετά από συγχώνευση που έφερε διαγραφές). */
export async function pruneBlobs(): Promise<void> {
  const used = referencedBlobs(all);
  await blobStore.remove((await blobStore.keys()).filter((k) => !used.has(k)));
}

/** Διαγραφή ΟΛΩΝ των δεδομένων της εφαρμογής από αυτή τη συσκευή. */
export async function wipeAll(): Promise<void> {
  await Promise.all([idb.clear('items'), idb.clear('blobs')]);
  set([]);
}
