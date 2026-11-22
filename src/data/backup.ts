/**
 * Αντίγραφο ασφαλείας: ΕΝΑ αρχείο .zip με τα στοιχεία (manifest.json) και όλα τα αρχεία (files/<blobId>).
 * Χρησιμεύει και για μεταφορά σε άλλη συσκευή: η εισαγωγή ΣΥΓΧΩΝΕΥΕΙ (δεν αντικαθιστά), με τον κανόνα του domain/merge.
 *
 * Το αρχείο που εισάγεται είναι άγνωστης προέλευσης: ελέγχονται μέγεθος, μορφή, κάθε προϊόν (zod), και περνούν μόνο
 * τα αρχεία που αναφέρει κάποιο προϊόν του αντιγράφου.
 *
 * Η εξαγωγή είναι πάντα κρυπτογραφημένη με κωδικό του χρήστη (data/backupCrypto): το .zip μπαίνει ολόκληρο μέσα σε ένα
 * αρχείο .mbackup. Η εισαγωγή δέχεται και τα παλιά, μη κρυπτογραφημένα .zip.
 */
import type { Zippable } from 'fflate';
import { z } from 'zod';
import { itemSchema, type Item } from '@/domain/model';
import { blobMimes, referencedBlobs, type MergeResult } from '@/domain/merge';
import { allItems, mergeIn } from './library';
import { blobStore } from './blobs';
import { BackupCryptoError, decryptBackup, encryptBackup, isEncryptedBackup } from './backupCrypto';

export const BACKUP_FORMAT = 'manuals-backup';
export const BACKUP_VERSION = 1;
export const BACKUP_EXTENSION = 'mbackup';
const MAX_BYTES = 2 * 1024 ** 3; // 2 GB: πάνω από αυτό δεν χωρά αξιόπιστα στη μνήμη ενός κινητού
const MAX_ITEMS = 20_000;

const manifestSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.number().int(),
  items: z.array(z.unknown()).max(MAX_ITEMS),
});

export class BackupError extends Error {
  constructor(public code: 'too-big' | 'not-backup' | 'newer-version' | 'needs-password' | 'bad-password') { super(code); }
}

/** Κρυπτογραφημένο αντίγραφο (ο κωδικός ελέγχεται για ισχύ στην οθόνη — domain/password). */
export async function exportBackup(password: string): Promise<Blob> {
  return new Blob([await encryptBackup(await zipLibrary(), password)], { type: 'application/octet-stream' });
}

async function zipLibrary(): Promise<Uint8Array<ArrayBuffer>> {
  const { strToU8, zipSync } = await import('fflate'); // μόνο όταν χρειαστεί: όχι στο αρχείο εκκίνησης
  const items = allItems();
  const tree: Zippable = {
    'manifest.json': strToU8(JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: Date.now(), items })),
  };
  for (const id of referencedBlobs(items)) {
    const b = await blobStore.get(id);
    // level 0: PDF και JPEG είναι ήδη συμπιεσμένα — η επανασυμπίεση μόνο καθυστερεί
    if (b) tree[`files/${id}`] = [new Uint8Array(await b.arrayBuffer()), { level: 0 }];
  }
  return zipSync(tree) as Uint8Array<ArrayBuffer>;
}

/** Θέλει κωδικό αυτό το αρχείο; (κρυπτογραφημένο αντίγραφο) */
export async function backupNeedsPassword(file: Blob): Promise<boolean> {
  return isEncryptedBackup(new Uint8Array(await file.slice(0, 64).arrayBuffer()));
}

export interface ImportResult extends MergeResult { skipped: number }

export async function importBackup(file: Blob, password?: string): Promise<ImportResult> {
  if (file.size > MAX_BYTES) throw new BackupError('too-big');
  let bytes = new Uint8Array(await file.arrayBuffer());
  if (isEncryptedBackup(bytes)) {
    if (!password) throw new BackupError('needs-password');
    try { bytes = await decryptBackup(bytes, password); } catch (e) {
      throw new BackupError(e instanceof BackupCryptoError && e.code === 'unsupported' ? 'newer-version' : 'bad-password');
    }
  }
  const { strFromU8, unzipSync } = await import('fflate');
  let entries: Record<string, Uint8Array>;
  try { entries = unzipSync(bytes); } catch { throw new BackupError('not-backup'); }
  const raw = entries['manifest.json'];
  if (!raw) throw new BackupError('not-backup');
  let json: unknown;
  try { json = JSON.parse(strFromU8(raw)); } catch { throw new BackupError('not-backup'); }
  const head = z.object({ format: z.literal(BACKUP_FORMAT), version: z.number().int() }).safeParse(json);
  if (!head.success) throw new BackupError('not-backup');
  if (head.data.version > BACKUP_VERSION) throw new BackupError('newer-version');
  const manifest = manifestSchema.safeParse(json);
  if (!manifest.success) throw new BackupError('not-backup');

  // προϊόν που δεν περνά το σχήμα παραλείπεται (τα υπόλοιπα εισάγονται)· συνημμένο χωρίς τα bytes του αφαιρείται
  const items: Item[] = [];
  let skipped = 0;
  for (const r of manifest.data.items) {
    const p = itemSchema.safeParse(r);
    if (!p.success) { skipped++; continue; }
    const attachments = p.data.attachments.filter((a) => entries[`files/${a.blobId}`]).map((a) => (a.thumbId && !entries[`files/${a.thumbId}`] ? { ...a, thumbId: undefined } : a));
    items.push({ ...p.data, attachments });
  }
  // πρώτα τα αρχεία, μετά τα στοιχεία: ένα προϊόν δεν δείχνει ποτέ σε αρχείο που δεν έχει γραφτεί
  const mimes = blobMimes(items);
  for (const id of referencedBlobs(items)) {
    const bytes = entries[`files/${id}`];
    if (bytes) await blobStore.put(id, new Blob([bytes.slice().buffer], { type: mimes.get(id) ?? 'application/octet-stream' }));
  }
  return { ...(await mergeIn(items)), skipped };
}
