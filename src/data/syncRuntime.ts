/**
 * Ο συγχρονισμός «εν ώρα λειτουργίας»: δένει τη μηχανή (syncEngine) με την πραγματική βιβλιοθήκη, τα αρχεία και τον
 * πάροχο, αποφασίζει ΠΟΤΕ τρέχει ένας κύκλος, και δίνει στην οθόνη την κατάσταση. Ένας κύκλος τη φορά.
 * Τρέχει: στην εκκίνηση, όταν η εφαρμογή ξαναέρχεται μπροστά, όταν επανέρχεται το δίκτυο, λίγο μετά από κάθε αλλαγή, και
 * με το κουμπί «Συγχρονισμός τώρα». Είναι ανενεργός μέχρι να τον ανοίξει ο χρήστης στις Ρυθμίσεις.
 */
import { useSyncExternalStore } from 'react';
import { icloudProvider, ICLOUD_MAX_BLOB_BYTES, recreateICloudZones } from '@/services/icloud';
import * as idb from './idb';
import { blobStore } from './blobs';
import { allItems, mergeIn, onLibraryChange } from './library';
import { EMPTY_MEMO, SyncError, type SyncMemo, type SyncStatus } from './sync';
import { syncOnce, type MemoStore, type SyncReport } from './syncEngine';

const KEY = 'sync';
const memoStore: MemoStore = {
  load: async () => ({ ...EMPTY_MEMO, ...((await idb.getOne<Partial<SyncMemo>>('meta', KEY)) ?? {}) }),
  save: (m) => idb.write('meta', { put: [{ key: KEY, value: m }] }),
};

let status: SyncStatus = icloudProvider ? { kind: 'off' } : { kind: 'unsupported' };
let lastReport: SyncReport | null = null;
const listeners = new Set<() => void>();
function setStatus(s: SyncStatus) { status = s; listeners.forEach((l) => l()); }
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export const useSyncStatus = (): SyncStatus => useSyncExternalStore(subscribe, () => status);
/** Πόσα αρχεία έμειναν εκτός συγχρονισμού στον τελευταίο κύκλο επειδή ήταν πολύ μεγάλα. */
export const useTooBigCount = (): number => useSyncExternalStore(subscribe, () => lastReport?.blobsTooBig ?? 0);

let running = false, again = false;
let timer: ReturnType<typeof setTimeout> | undefined;

/** Ένας κύκλος τώρα (αν είναι ανοιχτός ο συγχρονισμός). Αν τρέχει ήδη, θα ακολουθήσει άλλος ένας μόλις τελειώσει. */
export async function syncNow(): Promise<void> {
  if (!icloudProvider) return;
  if (running) { again = true; return; }
  const memo = await memoStore.load();
  if (!memo.enabled) { setStatus({ kind: 'off' }); return; }
  running = true;
  setStatus({ kind: 'syncing', lastSync: memo.lastSync });
  try {
    lastReport = await syncOnce({
      provider: icloudProvider,
      library: { items: allItems, merge: mergeIn },
      blobs: blobStore,
      memo: memoStore,
      maxBlobBytes: ICLOUD_MAX_BLOB_BYTES,
    });
    setStatus({ kind: 'idle', lastSync: (await memoStore.load()).lastSync });
  } catch (e) {
    const code = e instanceof SyncError ? e.code : 'failed';
    // ο χρήστης έσβησε τα δεδομένα της εφαρμογής από το iCloud: ο συγχρονισμός κλείνει και ΔΕΝ τα ξανανεβάζει μόνος του
    if (code === 'remote-deleted') await memoStore.save({ ...EMPTY_MEMO, remoteDeleted: true });
    setStatus({ kind: 'error', code, lastSync: (await memoStore.load()).lastSync });
  } finally {
    running = false;
    if (again) { again = false; schedule(1000); }
  }
}

function schedule(ms: number) {
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow(), ms);
}

/** Άνοιγμα/κλείσιμο από τις Ρυθμίσεις. Στο άνοιγμα ξεκινά αμέσως κύκλος· το κλείσιμο δεν σβήνει τίποτα από το iCloud. */
export async function setSyncEnabled(on: boolean): Promise<void> {
  const memo = await memoStore.load();
  if (on && memo.remoteDeleted) {
    // ρητή απόφαση του χρήστη να ξανανεβάσει μετά από διαγραφή στο iCloud: ο χώρος ξαναδημιουργείται
    try { await recreateICloudZones(); }
    catch (e) { setStatus({ kind: 'error', code: e instanceof SyncError ? e.code : 'failed', lastSync: null }); return; }
  }
  await memoStore.save({ ...memo, enabled: on, remoteDeleted: on ? false : memo.remoteDeleted });
  if (on) await syncNow(); else setStatus({ kind: 'off' });
}

/** Αποσύνδεση αυτής της συσκευής από τον συγχρονισμό (π.χ. πριν σβηστούν όλα τα τοπικά δεδομένα). Το iCloud δεν αλλάζει. */
export async function resetSync(): Promise<void> {
  clearTimeout(timer);
  await memoStore.save({ ...EMPTY_MEMO });
  lastReport = null;
  if (icloudProvider) setStatus({ kind: 'off' });
}

/** Εκκίνηση (μία φορά, αφού φορτωθεί η βιβλιοθήκη). Χωρίς πάροχο (browser) δεν κάνει τίποτα. */
export function startSync(): void {
  if (!icloudProvider) return;
  void syncNow();
  onLibraryChange(() => schedule(4000)); // λίγο μετά την τελευταία αλλαγή, όχι σε κάθε πλήκτρο
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') schedule(500); });
  window.addEventListener('online', () => schedule(500));
}
