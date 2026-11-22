/**
 * Αρχεία που δίνει ο χρήστης (εισαγωγή) ή που κατεβαίνουν από διεύθυνση: έλεγχος ΠΕΡΙΕΧΟΜΕΝΟΥ, όχι κατάληξης.
 * Δεκτά: PDF (αρχίζει με «%PDF-») και εικόνες που ανοίγει ο browser.
 */
import { newId, type Attachment, type AttachmentKind } from '@/domain/model';
import { blobStore } from '@/data/blobs';
import { prepareImage } from './image';

export const MAX_FILE_BYTES = 200 * 1024 ** 2; // 200 MB ανά αρχείο
export class FileError extends Error {
  constructor(public code: 'too-big' | 'unsupported' | 'empty') { super(code); }
}

export async function isPdf(blob: Blob): Promise<boolean> {
  const head = new Uint8Array(await blob.slice(0, 1024).arrayBuffer());
  const sig = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
  for (let i = 0; i + sig.length <= head.length; i++) if (sig.every((b, k) => head[i + k] === b)) return true;
  return false;
}

/** Αποθηκεύει ένα αρχείο ως συνημμένο: PDF όπως είναι· εικόνα ως JPEG (σμίκρυνση) με μικρογραφία. */
export async function storeFile(file: Blob, o: { kind: AttachmentKind; name: string; origin: Attachment['origin']; sourceUrl?: string }): Promise<Attachment> {
  if (!file.size) throw new FileError('empty');
  if (file.size > MAX_FILE_BYTES) throw new FileError('too-big');
  const base = { id: newId(), kind: o.kind, addedAt: Date.now(), origin: o.origin, sourceUrl: o.sourceUrl, blobId: newId() };
  if (await isPdf(file)) {
    await blobStore.put(base.blobId, new Blob([file], { type: 'application/pdf' }));
    return { ...base, name: withExt(o.name, 'pdf'), mime: 'application/pdf', size: file.size };
  }
  let img;
  try { img = await prepareImage(file); } catch { throw new FileError('unsupported'); }
  const thumbId = newId();
  await blobStore.put(base.blobId, img.full);
  await blobStore.put(thumbId, img.thumb);
  return { ...base, name: withExt(o.name, 'jpg'), mime: 'image/jpeg', size: img.full.size, thumbId };
}

const withExt = (name: string, ext: string) => {
  // χωρίς χαρακτήρες που δεν επιτρέπονται σε ονόματα αρχείων (και χωρίς χαρακτήρες ελέγχου)
  const clean = [...name].map((ch) => (ch.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(ch) ? ' ' : ch)).join('').trim().slice(0, 120) || 'file';
  return new RegExp(`\\.${ext}$`, 'i').test(clean) ? clean : `${clean.replace(/\.[A-Za-z0-9]{1,5}$/, '')}.${ext}`;
};

/** Μέγεθος για εμφάνιση: «1,4 MB». */
export const prettySize = (n: number) => (n >= 1024 ** 2 ? `${(n / 1024 ** 2).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`).replace('.', ',');
