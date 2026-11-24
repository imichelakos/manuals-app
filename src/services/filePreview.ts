/**
 * Προβολή αρχείου μέσα στην εφαρμογή iOS με το QuickLook (ios/App/App/FilePreviewPlugin.swift): ζουμ, αναζήτηση στο PDF,
 * κοινοποίηση από το κουμπί της προβολής. Με `editable`, σημειώσεις (Markup) που αποθηκεύονται ΜΟΝΟ σε αντίγραφο —
 * το αρχικό δεν αλλάζει ποτέ· το αντίγραφο επιστρέφεται στην εφαρμογή για να μπει ως νέο έγγραφο.
 * Το αρχείο γράφεται προσωρινά στον φάκελο cache και σβήνεται μόλις κλείσει η προβολή.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { fromBase64, toBase64 } from './base64';

interface FilePreviewPlugin {
  preview(o: { path: string; title?: string; editable: boolean; closeOnBackground: boolean }): Promise<{ edited: string | null }>;
}
// τα plugins του Capacitor είναι Proxy που «απαντούν» και σε `then`: δηλώνονται στο επίπεδο του module, όχι μέσα σε Promise
const FilePreview = registerPlugin<FilePreviewPlugin>('FilePreview');

export const previewAvailable = Capacitor.getPlatform() === 'ios' && Capacitor.isPluginAvailable('FilePreview');

export interface PreviewOptions {
  /** τίτλος στη γραμμή της προβολής (αλλιώς το όνομα του αρχείου) */
  title?: string;
  /** σημειώσεις σε αντίγραφο */
  editable?: boolean;
  /** κλείσιμο της προβολής όταν η εφαρμογή πάει στο παρασκήνιο (όταν είναι ενεργό το κλείδωμα) */
  closeOnBackground?: boolean;
}

/** Ανοίγει την προβολή και περιμένει να κλείσει· επιστρέφει το αντίγραφο με τις σημειώσεις ή null. */
export async function previewFile(blob: Blob, name: string, o: PreviewOptions = {}): Promise<Blob | null> {
  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  // ξεχωριστός φάκελος ανά προβολή: δύο αρχεία με το ίδιο όνομα δεν συγκρούονται
  const path = `preview/${Date.now().toString(36)}/${name}`;
  const { uri } = await Filesystem.writeFile({ path, data: await toBase64(blob), directory: Directory.Cache, recursive: true });
  try {
    const r = await FilePreview.preview({ path: uri, title: o.title, editable: !!o.editable, closeOnBackground: !!o.closeOnBackground });
    return r.edited ? new Blob([fromBase64(r.edited)], { type: blob.type }) : null;
  } finally {
    await Filesystem.rmdir({ path: path.slice(0, path.lastIndexOf('/')), directory: Directory.Cache, recursive: true }).catch(() => {});
  }
}

