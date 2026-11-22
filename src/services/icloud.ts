/**
 * Πάροχος συγχρονισμού μέσω iCloud: λεπτή γέφυρα προς το plugin της εφαρμογής iOS (ios/App/App/ICloudSyncPlugin.swift),
 * που μιλά με το CloudKit στην ΙΔΙΩΤΙΚΗ βάση του χρήστη. Υπάρχει μόνο στην εφαρμογή iOS· στο web `icloudProvider` = null.
 * ΣΗΜ.: ο κώδικας Swift δεν έχει μεταγλωττιστεί ούτε τρέξει ακόμη σε συσκευή.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { Item } from '@/domain/model';
import { SyncError, type SyncErrorCode, type SyncProvider } from '@/data/sync';
import { fromBase64, toBase64 } from './base64';

interface ICloudSyncPlugin {
  status(): Promise<{ available: boolean }>;
  /** cursor: '' = από την αρχή· items: το JSON κάθε προϊόντος */
  pull(o: { cursor: string }): Promise<{ items: string[]; cursor: string; more: boolean }>;
  push(o: { ids: string[]; jsons: string[] }): Promise<void>;
  putBlob(o: { id: string; data: string }): Promise<void>;
  getBlob(o: { id: string }): Promise<{ data: string | null }>;
  removeBlobs(o: { ids: string[] }): Promise<void>;
  createZones(): Promise<void>;
}
// ΠΡΟΣΟΧΗ: τα plugins του Capacitor είναι Proxy που «απαντούν» σε κάθε μέθοδο, και σε `then` — αν επιστραφούν μέσα από
// Promise περνιούνται για thenable και η αναμονή κρέμεται. Γι' αυτό δηλώνεται εδώ, στο επίπεδο του module.
const ICloudSync = registerPlugin<ICloudSyncPlugin>('ICloudSync');

const CODES: SyncErrorCode[] = ['no-account', 'offline', 'cursor-expired', 'remote-deleted', 'quota', 'failed'];
/** Το plugin απορρίπτει με `code` από το λεξιλόγιο του SyncError· οτιδήποτε άλλο είναι «failed». */
async function call<T>(fn: () => Promise<T>): Promise<T> {
  try { return await fn(); }
  catch (e) {
    const code = (e as { code?: string }).code;
    throw new SyncError(CODES.includes(code as SyncErrorCode) ? (code as SyncErrorCode) : 'failed', (e as Error).message);
  }
}

const provider: SyncProvider = {
  available: () => call(async () => (await ICloudSync.status()).available),
  pull: (cursor) => call(async () => {
    const r = await ICloudSync.pull({ cursor: cursor ?? '' });
    // κάθε εγγραφή είναι κείμενο JSON· ό,τι δεν διαβάζεται περνά ως undefined και απορρίπτεται από το σχήμα της μηχανής
    return { items: r.items.map((s) => { try { return JSON.parse(s) as unknown; } catch { return undefined; } }), cursor: r.cursor, more: r.more };
  }),
  push: (items: Item[]) => call(() => ICloudSync.push({ ids: items.map((i) => i.id), jsons: items.map((i) => JSON.stringify(i)) })),
  putBlob: (id, blob) => call(async () => ICloudSync.putBlob({ id, data: await toBase64(blob) })),
  getBlob: (id) => call(async () => { const { data } = await ICloudSync.getBlob({ id }); return data ? fromBase64(data) : null; }),
  removeBlobs: (ids) => call(() => ICloudSync.removeBlobs({ ids })),
};

export const icloudProvider: SyncProvider | null = Capacitor.getPlatform() === 'ios' && Capacitor.isPluginAvailable('ICloudSync') ? provider : null;

/**
 * Ξαναδημιουργεί τον χώρο της εφαρμογής στο iCloud, αφού ο χρήστης τον έσβησε από τις Ρυθμίσεις της συσκευής και μετά
 * ξανάνοιξε ρητά τον συγχρονισμό. Ειδικό του iCloud — δεν ανήκει στο γενικό συμβόλαιο του παρόχου.
 */
export const recreateICloudZones = (): Promise<void> => call(() => ICloudSync.createZones());

/** Αρχεία πάνω από αυτό το μέγεθος δεν συγχρονίζονται: περνούν ολόκληρα από τη μνήμη (base64) στη γέφυρα προς το iOS. */
export const ICLOUD_MAX_BLOB_BYTES = 100 * 1024 ** 2;
