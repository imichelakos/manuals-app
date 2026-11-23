/**
 * Η «σάρωση» ενός εντύπου: από φωτογραφία του εξωφύλλου (scanCover) ή από PDF του εγχειριδίου (scanPdf). Ετοιμάζει την
 * εικόνα, διαβάζει QR/barcode και κείμενο, και προτείνει μάρκα / μοντέλο / κατηγορία. Τίποτα δεν αποθηκεύεται εδώ — το
 * αποτέλεσμα το βλέπει και το διορθώνει ο χρήστης.
 */
import { identify, type Identification } from '@/domain/identify';
import type { CodePayload } from '@/domain/codes';
import { prepareImage } from './image';
import { readCodes, warmCodeReader } from './codeReader';
import { readText, warmOcr } from './ocr';
import { readPdf } from './pdfReader';
import { pdfPageCount } from './pdfPages';

export type ScanStep = 'image' | 'codes' | 'text' | 'done';
export interface ScanResult {
  /** εξώφυλλο (φωτογραφία, ή η πρώτη σελίδα του PDF)· λείπει όταν το PDF δεν διαβάστηκε (π.χ. στο web) */
  cover?: Blob;
  thumb?: Blob;
  codes: CodePayload[];
  text: string;
  found: Identification;
  /** από «Εισαγωγή PDF»: το ίδιο το εγχειρίδιο, για να αποθηκευτεί ως ψηφιακό */
  pdf?: { blob: Blob; name: string; pages?: number };
}

/** Φόρτωση OCR και ανάγνωσης κωδικών από πριν, όσο ο χρήστης ετοιμάζει τη φωτογραφία. */
export function warmScan(): void { warmOcr(); warmCodeReader(); }

export async function scanCover(photo: Blob, onStep: (s: ScanStep, progress?: number) => void): Promise<ScanResult> {
  onStep('image');
  const { full, thumb, canvas } = await prepareImage(photo);
  return { cover: full, thumb, ...(await readImage(canvas, onStep)) };
}

/** QR/barcode και OCR μιας εικόνας εξωφύλλου (κοινό για φωτογραφία και για την πρώτη σελίδα PDF χωρίς κείμενο). */
async function readImage(canvas: HTMLCanvasElement, onStep: (s: ScanStep, progress?: number) => void): Promise<Pick<ScanResult, 'codes' | 'text' | 'found'>> {
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
  return { codes, text: [text.ell, text.eng].filter(Boolean).join('\n'), found: identify({ latin: text.eng, greek: text.ell }, urls) };
}

/**
 * Αναγνώριση από PDF: μάρκα και μοντέλο ΠΡΩΤΑ από την πρώτη σελίδα (εξώφυλλο) και το όνομα του αρχείου — όχι από όλο το
 * έγγραφο, όπου λέξεις όπως «Seat belts» θα έδιναν λάθος μάρκα. Μόνο αν εκεί δεν βρεθεί τίποτα, από τις επόμενες
 * αρχικές σελίδες. Η κατηγορία από όλες τις αρχικές σελίδες.
 */
export function identifyPdf(pageTexts: string[], fileName: string, urls: string[]): Identification {
  const name = nameText(fileName);
  const cover = `${pageTexts[0] ?? ''}\n${name}`;
  const early = `${pageTexts.join('\n')}\n${name}`;
  const fromEarly = identify({ latin: early, greek: early }, urls);
  const fromCover = identify({ latin: cover, greek: cover }, urls, fromEarly.category);
  return {
    brands: fromCover.brands.length ? fromCover.brands : fromEarly.brands,
    models: fromCover.models.length ? fromCover.models : fromEarly.models,
    category: fromEarly.category,
    productWord: fromCover.productWord || fromEarly.productWord,
  };
}

/** «Bosch-WAU28PH9BY_manual.pdf» → «Bosch WAU28PH9BY manual» */
const nameText = (fileName: string) => fileName.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ');

/** λιγότερο κείμενο από αυτό: το PDF είναι μάλλον σκαναρισμένες εικόνες → OCR στην πρώτη σελίδα */
const MIN_PDF_TEXT = 30;

/**
 * «Εισαγωγή PDF»: το κείμενο έρχεται κατευθείαν από το PDF (PDFKit, στην εφαρμογή iOS) — πιο ακριβές και πιο γρήγορο από
 * OCR. Η πρώτη σελίδα γίνεται εξώφυλλο και διαβάζονται τα QR της. Χωρίς ανάγνωση PDF (web) μένει το όνομα του αρχείου.
 */
export async function scanPdf(pdf: File, onStep: (s: ScanStep, progress?: number) => void): Promise<ScanResult> {
  onStep('image');
  const info = await readPdf(pdf);
  const name = pdf.name || 'manual.pdf';
  const base = { pdf: { blob: pdf, name, pages: info?.pages || (await pdfPageCount(pdf)) } };
  const fromName = nameText(name);
  if (!info?.cover) {
    onStep('done');
    return { ...base, codes: [], text: fromName, found: identify({ latin: fromName, greek: fromName }, []) };
  }
  const { full, thumb, canvas } = await prepareImage(info.cover);
  const all = info.pageTexts.join('\n');
  if (all.trim().length < MIN_PDF_TEXT) return { ...base, cover: full, thumb, ...(await readImage(canvas, onStep)) };
  onStep('codes');
  const codes = await readCodes(canvas);
  const urls = codes.flatMap((c) => (c.type === 'link' ? [c.url] : []));
  let found = identifyPdf(info.pageTexts, name, urls);
  let text = all;
  // η μάρκα δεν είναι στο κείμενο ούτε στο όνομα του αρχείου (συχνά είναι λογότυπο-εικόνα): OCR στο εξώφυλλο και,
  // αν ούτε εκεί βρεθεί, στη 2η σελίδα (απόφαση 23/11/2026)
  if (!found.brands.length) {
    const page2 = info.page2 ? async () => (await prepareImage(info.page2!)).canvas : null;
    for (const image of [async () => canvas, page2]) {
      if (!image) continue;
      onStep('text', 0);
      const ocr = (await readText(await image(), { langs: ['eng'], sparse: true, onProgress: (p) => onStep('text', p) })).eng;
      const withLogo = identifyPdf([ocr, ...info.pageTexts], name, urls);
      if (withLogo.brands.length) {
        // από το OCR κυρίως η μάρκα: το κείμενο του PDF είναι ακριβέστερο για κωδικούς μοντέλου. Εξαίρεση τα οχήματα, όπου
        // μοντέλο είναι όνομα δίπλα στο λογότυπο (Micra) και οι κωδικοί του κειμένου είναι συνήθως κωδικοί εγγράφου
        const models = found.category === 'vehicle'
          ? [...new Set([...withLogo.models, ...found.models])].slice(0, 6)
          : found.models.length ? found.models : withLogo.models;
        found = { ...found, brands: withLogo.brands, models };
        text = `${ocr}\n${all}`;
        break;
      }
    }
  }
  onStep('done');
  return { ...base, cover: full, thumb, codes, text, found };
}
