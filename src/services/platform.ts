/**
 * Ό,τι διαφέρει ανάμεσα στα τρία περιβάλλοντα όπου τρέχει η εφαρμογή: εφαρμογή iOS (Capacitor), browser, και σελίδα
 * προεπισκόπησης μέσα σε host που απαγορεύει στη σελίδα να κατεβάζει ή να ανοίγει παράθυρα μόνη της (services/hostSave).
 * Τα plugins φορτώνονται μόνο στην εφαρμογή (lazy import). ΣΗΜ.: οι κλάδοι «native» δεν έχουν δοκιμαστεί ακόμη σε συσκευή.
 */
import { Capacitor } from '@capacitor/core';
import { hostSave } from './hostSave';
import { toBase64 } from './base64';

export const isNative = Capacitor.isNativePlatform();

/**
 * Άνοιγμα εξωτερικής σελίδας στην εφαρμογή iOS: φύλλο Safari μέσα στην εφαρμογή. Στο web οι εξωτερικές σελίδες είναι
 * πραγματικοί σύνδεσμοι (components/ExternalLink) — ο browser τις ανοίγει μόνος του σε νέα καρτέλα.
 */
export async function openInApp(url: string): Promise<void> {
  const { Browser } = await import('@capacitor/browser');
  await Browser.open({ url });
}

/**
 * Άνοιγμα ενός αποθηκευμένου αρχείου (PDF/εικόνα) έξω από την εφαρμογή.
 * Εφαρμογή: προσωρινό αντίγραφο στον φάκελο cache και φύλλο κοινοποίησης iOS (Άνοιγμα σε…, Αρχεία, Εκτύπωση).
 * Browser: κοινοποίηση αρχείου αν υποστηρίζεται, αλλιώς άνοιγμα σε νέα καρτέλα.
 */
export async function openFile(blob: Blob, name: string): Promise<void> {
  if (isNative) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
    const { uri } = await Filesystem.writeFile({ path: `share/${name}`, data: await toBase64(blob), directory: Directory.Cache, recursive: true });
    await Share.share({ files: [uri] }).catch(() => {}); // ακύρωση από τον χρήστη: όχι σφάλμα
    return;
  }
  if (await hostSave(blob, name)) return; // προεπισκόπηση: το αρχείο δίνεται στον χρήστη μέσω του host
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (!w) await saveFile(blob, name); // μπλοκαρισμένο αναδυόμενο → λήψη
  setTimeout(() => URL.revokeObjectURL(url), 5 * 60_000);
}

/** Αποθήκευση αρχείου στη συσκευή του χρήστη (λήψη / φύλλο κοινοποίησης). */
export async function saveFile(blob: Blob, name: string): Promise<void> {
  if (isNative) return openFile(blob, name);
  if (await hostSave(blob, name)) return;
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
    try { await navigator.share({ files: [file] }); return; } catch (e) { if ((e as Error).name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
