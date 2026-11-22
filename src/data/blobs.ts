/**
 * Αποθήκη αρχείων (PDF, φωτογραφίες): τα bytes κρατιούνται χωριστά από τα στοιχεία του προϊόντος, με κλειδί blobId.
 * Η διεπαφή BlobStore είναι το μόνο που ξέρει η υπόλοιπη εφαρμογή — σήμερα πίσω της είναι το IndexedDB· άλλη υλοποίηση
 * (π.χ. αρχεία στον φάκελο της εφαρμογής στο iOS, ώστε να τα βλέπει το iCloud) μπαίνει χωρίς να αλλάξει τίποτα άλλο.
 */
import * as idb from './idb';

export interface BlobStore {
  put(id: string, blob: Blob): Promise<void>;
  get(id: string): Promise<Blob | null>;
  remove(ids: string[]): Promise<void>;
  keys(): Promise<string[]>;
}

interface Stored { mime: string; data: ArrayBuffer }

export const blobStore: BlobStore = {
  async put(id, blob) { await idb.write('blobs', { put: [{ key: id, value: { mime: blob.type, data: await blob.arrayBuffer() } satisfies Stored }] }); },
  async get(id) { const s = await idb.getOne<Stored>('blobs', id); return s ? new Blob([s.data], { type: s.mime }) : null; },
  async remove(ids) { if (ids.length) await idb.write('blobs', { del: ids }); },
  keys: () => idb.allKeys('blobs'),
};
