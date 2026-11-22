/**
 * Αυτόματος συγχρονισμός μεταξύ συσκευών — ΣΥΜΒΟΛΑΙΟ, χωρίς υλοποίηση ακόμη.
 *
 * Τα δεδομένα είναι ήδη έτοιμα για συγχρονισμό: κάθε προϊόν έχει σταθερό id και updatedAt, οι διαγραφές είναι ταφόπλακες,
 * τα αρχεία έχουν αμετάβλητο blobId, και η συγχώνευση (domain/merge) είναι ο ίδιος κανόνας που χρησιμοποιεί το αντίγραφο
 * ασφαλείας. Ένας πάροχος (iCloud ή δικός μας server) χρειάζεται μόνο να μεταφέρει προϊόντα και αρχεία:
 */
import type { Item } from '@/domain/model';

export interface SyncProvider {
  /** προϊόντα που άλλαξαν στον πάροχο μετά το σημάδι `since` (αδιαφανές, το ορίζει ο πάροχος) */
  pull(since: string | null): Promise<{ items: Item[]; cursor: string }>;
  /** στέλνει τοπικές αλλαγές (μαζί με ταφόπλακες) */
  push(items: Item[]): Promise<void>;
  /** αρχεία: ανεβαίνουν μία φορά (το blobId δεν αλλάζει ποτέ περιεχόμενο) και κατεβαίνουν όταν χρειαστούν */
  hasBlob(id: string): Promise<boolean>;
  putBlob(id: string, blob: Blob): Promise<void>;
  getBlob(id: string): Promise<Blob | null>;
}

export type SyncState = { kind: 'off' } | { kind: 'idle'; lastSync: number } | { kind: 'syncing' } | { kind: 'error'; message: string };

/** Σήμερα δεν υπάρχει πάροχος: η μεταφορά μεταξύ συσκευών γίνεται με το αντίγραφο ασφαλείας (Ρυθμίσεις). */
export const syncState = (): SyncState => ({ kind: 'off' });
