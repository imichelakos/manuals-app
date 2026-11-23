/**
 * Σάρωση QR αργότερα (Σύνδεσμοι του προϊόντος). Στο iPhone/iPad με iOS 16+ και A12+: ζωντανή σάρωση της Apple
 * (ios/App/App/QrScannerPlugin.swift — το QR αναγνωρίζεται μόλις φανεί). Αλλιώς: φωτογραφία και ανάγνωση όλων των QR
 * της με τον ίδιο αναγνώστη της σάρωσης εντύπου.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { classifyCode, type CodePayload } from '@/domain/codes';
import { prepareImage } from './image';
import { readCodes } from './codeReader';

interface QrScannerPlugin {
  isSupported(): Promise<{ supported: boolean }>;
  scan(): Promise<{ cancelled: boolean; value: string | null }>;
}
// τα plugins του Capacitor είναι Proxy που «απαντούν» και σε `then`: δηλώνονται στο επίπεδο του module, όχι μέσα σε Promise
const QrScanner = registerPlugin<QrScannerPlugin>('QrScanner');
const present = Capacitor.getPlatform() === 'ios' && Capacitor.isPluginAvailable('QrScanner');

let supported: Promise<boolean> | null = null;
export function liveQrSupported(): Promise<boolean> {
  supported ??= present ? QrScanner.isSupported().then((r) => r.supported, () => false) : Promise.resolve(false);
  return supported;
}

/** Ζωντανή σάρωση· null: ακύρωση. */
export async function scanQrLive(): Promise<CodePayload[] | null> {
  const r = await QrScanner.scan();
  return r.cancelled || !r.value ? null : [classifyCode(r.value)];
}

/** Όλα τα QR/barcodes μιας φωτογραφίας. */
export async function codesFromPhoto(photo: Blob): Promise<CodePayload[]> {
  const { canvas } = await prepareImage(photo);
  return readCodes(canvas);
}
