/**
 * Αποθήκη αρχείων (PDF, φωτογραφίες): τα bytes κρατιούνται χωριστά από τα στοιχεία του προϊόντος, με κλειδί blobId.
 * Στον δίσκο κάθε αρχείο είναι κρυπτογραφημένο (data/codec, κλειδί από το data/vault).
 * Η διεπαφή BlobStore είναι το μόνο που ξέρει η υπόλοιπη εφαρμογή — σήμερα πίσω της είναι το IndexedDB· άλλη υλοποίηση
 * (π.χ. αρχεία στον φάκελο της εφαρμογής στο iOS, ώστε να τα βλέπει το iCloud) μπαίνει χωρίς να αλλάξει τίποτα άλλο.
 */
import * as idb from './idb';
import { isSealed, openBlob, sealBlob, type SealedBlob } from './codec';
import { vaultKey } from './vault';

export interface BlobStore {
  put(id: string, blob: Blob): Promise<void>;
  get(id: string): Promise<Blob | null>;
  remove(ids: string[]): Promise<void>;
  keys(): Promise<string[]>;
}

/** Παλιά απλή εγγραφή (από πριν την κρυπτογράφηση) — διαβάζεται και ξαναγράφεται κρυπτογραφημένη. */
interface Plain { mime: string; data: ArrayBuffer }

export const blobStore: BlobStore = {
  async put(id, blob) { await idb.write('blobs', { put: [{ key: id, value: await sealBlob(vaultKey(), id, blob) }] }); },
  async get(id) {
    const s = await idb.getOne<SealedBlob | Plain>('blobs', id);
    if (!s) return null;
    if (isSealed(s)) return openBlob(vaultKey(), id, s);
    const blob = new Blob([s.data], { type: s.mime });
    await blobStore.put(id, blob); // μετάβαση: απλό → κρυπτογραφημένο
    return blob;
  },
  async remove(ids) { if (ids.length) await idb.write('blobs', { del: ids }); },
  keys: () => idb.allKeys('blobs'),
};
