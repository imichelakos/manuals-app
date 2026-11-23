/**
 * Κείμενο ενός παραστατικού πριν αποθηκευτεί: για την εκτίμηση «μοιάζει με παραστατικό;» και την πρόταση ημερομηνίας
 * αγοράς (domain/receiptHints). Πηγές, με τη σειρά: η εικόνα της 1ης σελίδας από τον σαρωτή, μια εικόνα από αρχείο,
 * ή ένα PDF — το κείμενό του κατευθείαν (PDFKit, iOS) ή OCR στην εικόνα της 1ης σελίδας του. null: δεν υπάρχει τρόπος
 * ανάγνωσης εδώ (π.χ. PDF στο web).
 */
import { readText } from './ocr';
import { readPdf } from './pdfReader';

/** text: όλο το κείμενο (ελληνικά + αγγλικά μοντέλα, για τις λέξεις) · dateText: για ημερομηνίες (ψηφία → αγγλικό μοντέλο) */
export interface ReceiptText { text: string; dateText: string }

async function ocr(image: Blob): Promise<ReceiptText> {
  const r = await readText(image, { langs: ['eng', 'ell'], sparse: false });
  return { text: `${r.eng}\n${r.ell}`, dateText: r.eng };
}

export async function readReceipt(files: File[], firstPage?: Blob | null): Promise<ReceiptText | null> {
  try {
    if (firstPage) return await ocr(firstPage);
    const image = files.find((f) => f.type.startsWith('image/'));
    if (image) return await ocr(image);
    const pdf = files.find((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (!pdf) return null;
    const info = await readPdf(pdf);
    if (!info || info.locked) return null;
    const text = info.pageTexts.join('\n').trim();
    if (text) return { text, dateText: text };               // ηλεκτρονικό παραστατικό: κείμενο χωρίς OCR
    return info.cover ? await ocr(info.cover) : null;       // σκαναρισμένο PDF: OCR στην 1η σελίδα
  } catch { return null; }
}
