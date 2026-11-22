/**
 * Συγχρονισμός μεταξύ συσκευών — το ΣΥΜΒΟΛΑΙΟ ανάμεσα στη μηχανή συγχρονισμού (data/syncEngine) και σε έναν πάροχο
 * αποθήκευσης (services/icloud). Ο πάροχος είναι απλή μεταφορά: δεν αποφασίζει ποια εκδοχή κερδίζει — αυτό το κάνει ο
 * κανόνας του domain/merge, ίδιος σε κάθε συσκευή.
 */
import type { Item } from '@/domain/model';

export type SyncErrorCode =
  | 'no-account'      // δεν υπάρχει συνδεδεμένος λογαριασμός στον πάροχο
  | 'offline'         // δίκτυο / προσωρινή αδυναμία — ξαναδοκιμάζεται αργότερα
  | 'cursor-expired'  // το σημάδι αλλαγών δεν ισχύει πια — χρειάζεται πλήρες κατέβασμα
  | 'remote-deleted'  // ο χρήστης έσβησε τα δεδομένα της εφαρμογής από τον πάροχο
  | 'quota'           // δεν υπάρχει χώρος στον λογαριασμό του χρήστη
  | 'failed';         // οτιδήποτε άλλο

export class SyncError extends Error {
  constructor(public code: SyncErrorCode, detail?: string) { super(detail ? `${code}: ${detail}` : code); }
}

export interface SyncProvider {
  /** Είναι διαθέσιμος ο λογαριασμός του χρήστη στον πάροχο; */
  available(): Promise<boolean>;
  /**
   * Προϊόντα που άλλαξαν στον πάροχο μετά το σημάδι `cursor` (αδιαφανές· null = από την αρχή). Έρχονται ΑΝΕΛΕΓΚΤΑ
   * (unknown): η μηχανή τα περνά από το σχήμα. `more`: υπάρχουν κι άλλα — ξαναζήτα με το νέο σημάδι.
   */
  pull(cursor: string | null): Promise<{ items: unknown[]; cursor: string; more: boolean }>;
  /** Αποθηκεύει (ή αντικαθιστά) προϊόντα, μαζί με ταφόπλακες. */
  push(items: Item[]): Promise<void>;
  /** Αρχεία: το blobId δεν αλλάζει ποτέ περιεχόμενο, άρα ανεβαίνει μία φορά. `getBlob` → null αν δεν υπάρχει (ακόμη). */
  putBlob(id: string, blob: Blob): Promise<void>;
  getBlob(id: string): Promise<Blob | null>;
  removeBlobs(ids: string[]): Promise<void>;
}

/** Όσα θυμάται η μηχανή ανάμεσα σε συγχρονισμούς (ανά συσκευή). */
export interface SyncMemo {
  enabled: boolean;
  cursor: string | null;
  /** id προϊόντος → το updatedAt της εκδοχής που ξέρουμε ότι υπάρχει στον πάροχο */
  pushed: Record<string, number>;
  /** αρχεία που ξέρουμε ότι υπάρχουν στον πάροχο */
  uploaded: string[];
  lastSync: number | null;
  /** ο χρήστης έσβησε τα δεδομένα της εφαρμογής από τον πάροχο: στο επόμενο ρητό άνοιγμα ο χώρος ξαναδημιουργείται */
  remoteDeleted?: boolean;
}
export const EMPTY_MEMO: SyncMemo = { enabled: false, cursor: null, pushed: {}, uploaded: [], lastSync: null };

export type SyncStatus =
  | { kind: 'unsupported' }                       // αυτό το περιβάλλον δεν έχει πάροχο (browser)
  | { kind: 'off' }
  | { kind: 'syncing'; lastSync: number | null }
  | { kind: 'idle'; lastSync: number | null }
  | { kind: 'error'; code: SyncErrorCode; lastSync: number | null };
