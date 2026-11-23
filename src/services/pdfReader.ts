/**
 * Ανάγνωση PDF για την «Εισαγωγή PDF» της σάρωσης: στην εφαρμογή iOS με το PDFKit (ios/App/App/PdfReaderPlugin.swift)
 * — κείμενο των πρώτων σελίδων, πλήθος σελίδων, πρώτη σελίδα ως εικόνα. Στο web δεν υπάρχει (null): ο καλών συνεχίζει
 * χωρίς προσυμπλήρωση (αξιολόγηση pdf.js στη Φάση 1). Το αρχείο δεν φεύγει από τη συσκευή.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { fromBase64, toBase64 } from './base64';

interface PdfReaderPlugin {
  read(o: { data: string; maxPages?: number; coverWidth?: number }): Promise<{ pages: number; pageTexts: string[]; cover: string | null; locked: boolean }>;
}
// τα plugins του Capacitor είναι Proxy που «απαντούν» και σε `then`: δηλώνονται στο επίπεδο του module, όχι μέσα σε Promise
const PdfReader = registerPlugin<PdfReaderPlugin>('PdfReader');

export const pdfReaderAvailable = Capacitor.getPlatform() === 'ios' && Capacitor.isPluginAvailable('PdfReader');

/** πάνω από αυτό το μέγεθος δεν στέλνεται για ανάλυση (περνά ολόκληρο, ως base64, από τη γέφυρα προς το iOS) */
const MAX_ANALYSIS_BYTES = 60 * 1024 ** 2;

/** pageTexts: κείμενο των πρώτων σελίδων, ανά σελίδα (η πρώτη = εξώφυλλο) */
export interface PdfInfo { pages: number; pageTexts: string[]; cover: Blob | null; locked: boolean }

/** null: δεν υπάρχει ανάγνωση PDF εδώ (web), το αρχείο είναι πολύ μεγάλο ή η ανάγνωση απέτυχε. */
export async function readPdf(pdf: Blob): Promise<PdfInfo | null> {
  if (!pdfReaderAvailable || pdf.size > MAX_ANALYSIS_BYTES) return null;
  try {
    const r = await PdfReader.read({ data: await toBase64(pdf), maxPages: 3, coverWidth: 1400 });
    const cover = r.cover ? new Blob([fromBase64(r.cover)], { type: 'image/jpeg' }) : null;
    return { pages: r.pages, pageTexts: r.pageTexts ?? [], cover, locked: r.locked };
  } catch { return null; }
}
