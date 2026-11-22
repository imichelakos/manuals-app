/**
 * Ανάγνωση QR και barcode από εικόνα, στη συσκευή. Ίδια μηχανή παντού (ZXing σε WebAssembly μέσω του ponyfill του
 * Barcode Detection API): το Safari / iOS δεν έχει δικό του BarcodeDetector. Το .wasm σερβίρεται τοπικά (public/zxing).
 */
import { classifyCode, type CodePayload } from '@/domain/codes';

type Source = Blob | HTMLCanvasElement;
let detector: Promise<{ detect(src: Source): Promise<{ rawValue: string }[]> }> | null = null;

function get() {
  return (detector ??= import('barcode-detector/ponyfill').then(({ BarcodeDetector, prepareZXingModule }) => {
    const base = new URL('zxing/', document.baseURI).href;
    prepareZXingModule({ overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? base + path : prefix + path) } });
    return new BarcodeDetector({ formats: ['qr_code', 'micro_qr_code', 'data_matrix', 'aztec', 'ean_13', 'ean_8', 'upc_a', 'upc_e'] });
  }));
}

/** Όλοι οι κωδικοί της εικόνας, χωρίς διπλούς, ήδη ταξινομημένοι σε σύνδεσμο / barcode / κείμενο. */
export async function readCodes(image: Source): Promise<CodePayload[]> {
  try {
    const found = await (await get()).detect(image);
    const seen = new Set<string>();
    return found.flatMap((f) => (f.rawValue && !seen.has(f.rawValue) ? (seen.add(f.rawValue), [classifyCode(f.rawValue)]) : []));
  } catch {
    detector = null; // αποτυχία φόρτωσης: η σάρωση συνεχίζει χωρίς κωδικούς
    return [];
  }
}
