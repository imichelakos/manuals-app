/**
 * Αντίγραφο ασφαλείας: ΕΝΑ αρχείο .zip με τα στοιχεία (manifest.json) και όλα τα αρχεία (files/<blobId>).
 * Χρησιμεύει και για μεταφορά σε άλλη συσκευή: η εισαγωγή ΣΥΓΧΩΝΕΥΕΙ (δεν αντικαθιστά), με τον κανόνα του domain/merge.
 *
 * Το αρχείο που εισάγεται είναι άγνωστης προέλευσης: ελέγχονται μέγεθος, μορφή, κάθε προϊόν (zod), και περνούν μόνο
 * τα αρχεία που αναφέρει κάποιο προϊόν του αντιγράφου. Το αντίγραφο ΔΕΝ είναι κρυπτογραφημένο.
 */
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from 'fflate';
import { z } from 'zod';
import { itemSchema, type Item } from '@/domain/model';
import { blobMimes, referencedBlobs, type MergeResult } from '@/domain/merge';
import { allItems, mergeIn } from './library';
import { blobStore } from './blobs';

export const BACKUP_FORMAT = 'manuals-backup';
export const BACKUP_VERSION = 1;
const MAX_BYTES = 2 * 1024 ** 3; // 2 GB: πάνω από αυτό δεν χωρά αξιόπιστα στη μνήμη ενός κινητού
const MAX_ITEMS = 20_000;

const manifestSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.number().int(),
  items: z.array(z.unknown()).max(MAX_ITEMS),
});

export class BackupError extends Error {
  constructor(public code: 'too-big' | 'not-backup' | 'newer-version') { super(code); }
}

export async function exportBackup(): Promise<Blob> {
  const items = allItems();
  const tree: Zippable = {
    'manifest.json': strToU8(JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: Date.now(), items })),
  };
  for (const id of referencedBlobs(items)) {
    const b = await blobStore.get(id);
    // level 0: PDF και JPEG είναι ήδη συμπιεσμένα — η επανασυμπίεση μόνο καθυστερεί
    if (b) tree[`files/${id}`] = [new Uint8Array(await b.arrayBuffer()), { level: 0 }];
  }
  return new Blob([zipSync(tree)], { type: 'application/zip' });
}

export interface ImportResult extends MergeResult { skipped: number }

export async function importBackup(file: Blob): Promise<ImportResult> {
  if (file.size > MAX_BYTES) throw new BackupError('too-big');
  let entries: Record<string, Uint8Array>;
  try { entries = unzipSync(new Uint8Array(await file.arrayBuffer())); } catch { throw new BackupError('not-backup'); }
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
