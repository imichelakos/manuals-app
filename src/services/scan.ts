/**
 * Η «σάρωση» ενός εντύπου, από φωτογραφία του εξωφύλλου: ετοιμάζει την εικόνα, διαβάζει QR/barcode και κείμενο, και
 * προτείνει μάρκα / μοντέλο / κατηγορία. Τίποτα δεν αποθηκεύεται εδώ — το αποτέλεσμα το βλέπει και το διορθώνει ο χρήστης.
 */
import { identify, type Identification } from '@/domain/identify';
import type { CodePayload } from '@/domain/codes';
import { prepareImage } from './image';
import { readCodes, warmCodeReader } from './codeReader';
import { readText, warmOcr } from './ocr';

export type ScanStep = 'image' | 'codes' | 'text' | 'done';
export interface ScanResult {
  cover: Blob;
  thumb: Blob;
  codes: CodePayload[];
  text: string;
  found: Identification;
}

/** Φόρτωση OCR και ανάγνωσης κωδικών από πριν, όσο ο χρήστης ετοιμάζει τη φωτογραφία. */
export function warmScan(): void { warmOcr(); warmCodeReader(); }

export async function scanCover(photo: Blob, onStep: (s: ScanStep, progress?: number) => void): Promise<ScanResult> {
  onStep('image');
  const { full, thumb, canvas } = await prepareImage(photo);
  // το OCR τρέχει σε worker: ξεκινά αμέσως και οι κωδικοί διαβάζονται στο μεταξύ (όχι πρώτα ο ένας και μετά ο άλλος)
  let progress = 0, codesDone = false;
  const textP = readText(canvas, { langs: ['eng', 'ell'], sparse: true, onProgress: (p) => { progress = p; if (codesDone) onStep('text', p); } });
  onStep('codes');
  const codes = await readCodes(canvas);
  codesDone = true;
  onStep('text', progress);
  const text = await textP;
  const urls = codes.flatMap((c) => (c.type === 'link' ? [c.url] : []));
  onStep('done');
  // για την αναζήτηση κρατιέται πρώτα το ελληνικό πέρασμα (λέξεις) και μετά το λατινικό (μάρκα, κωδικοί)
  return { cover: full, thumb, codes, text: [text.ell, text.eng].filter(Boolean).join('\n'), found: identify({ latin: text.eng, greek: text.ell }, urls) };
}
