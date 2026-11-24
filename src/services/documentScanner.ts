/**
 * Σαρωτής εγγράφων του iOS (VisionKit, ios/App/App/DocumentScannerPlugin.swift): εντοπίζει τις άκρες της σελίδας,
 * την ισιώνει και σαρώνει πολλές σελίδες στη σειρά. Στο web ή σε συσκευή χωρίς υποστήριξη δεν υπάρχει· τότε η εφαρμογή
 * ανοίγει την κάμερα όπως πριν (components/CameraPick). Οι εικόνες δεν φεύγουν από τη συσκευή.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { fromBase64 } from './base64';
import { closeScreensOnBackground } from './nativeScreens';

interface DocumentScannerPlugin {
  isSupported(): Promise<{ supported: boolean }>;
  scan(o: { pdf?: boolean; maxPages?: number; maxSide?: number; closeOnBackground?: boolean }): Promise<{ cancelled: boolean; pages: string[]; pageCount: number; pdf: string | null }>;
}
// τα plugins του Capacitor είναι Proxy που «απαντούν» και σε `then`: δηλώνονται στο επίπεδο του module, όχι μέσα σε Promise
const DocumentScanner = registerPlugin<DocumentScannerPlugin>('DocumentScanner');

const pluginPresent = Capacitor.getPlatform() === 'ios' && Capacitor.isPluginAvailable('DocumentScanner');
let supported: Promise<boolean> | null = null;
/** Υπάρχει σαρωτής εδώ; (ρωτά το iOS μία φορά) */
export function scannerSupported(): Promise<boolean> {
  supported ??= pluginPresent ? DocumentScanner.isSupported().then((r) => r.supported, () => false) : Promise.resolve(false);
  return supported;
}

/** photo: μόνο η πρώτη σελίδα ως JPEG (εξώφυλλο) · document: ένα PDF με όλες τις σελίδες, και η 1η ως εικόνα */
export type ScanMode = 'photo' | 'document';
/** files: ό,τι αποθηκεύεται (JPEG ή PDF) · firstPage: εικόνα της 1ης σελίδας (για OCR, π.χ. ημερομηνία απόδειξης) · pages: πόσες σαρώθηκαν */
export interface ScanCapture { files: File[]; firstPage: Blob | null; pages: number }

const stamp = () => new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-');

/** null: ο χρήστης ακύρωσε. Σε αποτυχία πετά σφάλμα. */
export async function scanDocument(mode: ScanMode): Promise<ScanCapture | null> {
  const r = await DocumentScanner.scan({ pdf: mode === 'document', maxPages: 1, maxSide: 2000, closeOnBackground: closeScreensOnBackground() });
  if (r.cancelled || !r.pages.length) return null;
  const first = new Blob([fromBase64(r.pages[0]!)], { type: 'image/jpeg' });
  if (mode === 'photo' || !r.pdf) return { files: [new File([first], `scan-${stamp()}.jpg`, { type: 'image/jpeg' })], firstPage: first, pages: r.pageCount };
  return { files: [new File([fromBase64(r.pdf)], `scan-${stamp()}.pdf`, { type: 'application/pdf' })], firstPage: first, pages: r.pageCount };
}
