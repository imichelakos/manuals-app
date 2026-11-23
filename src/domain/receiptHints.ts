/**
 * Ημερομηνίες που εμφανίζονται στο κείμενο ενός παραστατικού (OCR) — προτείνονται ως «ημερομηνία αγοράς».
 * Μόνο πρόταση: ο χρήστης διαλέγει. Δεκτές μορφές: ΗΗ/ΜΜ/ΕΕΕΕ, ΗΗ-ΜΜ-ΕΕ, ΗΗ.ΜΜ.ΕΕΕΕ, ΕΕΕΕ-ΜΜ-ΗΗ.
 */
import { isValid, toIso, type IsoDate } from './dates';

export function extractDates(text: string, todayIso: IsoDate): IsoDate[] {
  const found = new Set<IsoDate>();
  const add = (y: number, m: number, d: number) => {
    if (y < 100) y += 2000;
    if (y < 2000 || !isValid(y, m, d)) return;
    const iso = toIso(y, m, d);
    if (iso <= todayIso) found.add(iso); // όχι μελλοντικές (π.χ. ημερομηνία λήξης προσφοράς)
  };
  for (const r of text.matchAll(/(?<!\d)(\d{1,2})[./-](\d{1,2})[./-](\d{4}|\d{2})(?!\d)/g)) add(+r[3]!, +r[2]!, +r[1]!);
  for (const r of text.matchAll(/(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g)) add(+r[1]!, +r[2]!, +r[3]!);
  return [...found].sort().reverse().slice(0, 4); // πιο πρόσφατες πρώτα
}

/**
 * «Μοιάζει με παραστατικό αγοράς;» — εκτίμηση από το κείμενο (OCR ή PDF), ΟΧΙ βεβαιότητα: χρειάζεται ημερομηνία ΚΑΙ
 * τουλάχιστον ένα ακόμη σημάδι — ποσό με νόμισμα ή λέξη παραστατικού/φόρου (6 γλώσσες). Όταν δεν μοιάζει, η εφαρμογή
 * ρωτά τον χρήστη πριν αποθηκεύσει (απόφαση 23/11/2026).
 */
// λέξεις σε κεφαλαία χωρίς τόνους· ταιριάζουν ως ολόκληρες λέξεις
const RECEIPT_WORDS = [
  'ΑΠΟΔΕΙΞΗ', 'ΤΙΜΟΛΟΓΙΟ', 'ΠΑΡΑΣΤΑΤΙΚΟ', 'ΑΦΜ', 'ΦΠΑ', 'ΣΥΝΟΛΟ', 'ΜΕΤΡΗΤΑ', 'ΚΑΡΤΑ',
  'RECEIPT', 'INVOICE', 'TOTAL', 'VAT', 'TAX', 'SUBTOTAL', 'CASH',
  'RECU', 'FACTURE', 'TVA', 'TICKET', 'MONTANT',
  'RECIBO', 'FACTURA', 'IVA', 'IMPORTE', 'NIF', 'CIF',
  'SCONTRINO', 'RICEVUTA', 'FATTURA', 'TOTALE', 'IMPORTO',
  'QUITTUNG', 'RECHNUNG', 'KASSENBON', 'BELEG', 'MWST', 'UST', 'SUMME', 'GESAMT', 'BETRAG',
];
// ποσό με νόμισμα: «12,50 €», «€12.50», «12.50 EUR», «EUR 12,50»
const AMOUNT = /(?:€|EUR)\s?\d+(?:[.,]\d{2})|\d+[.,]\d{2}\s?(?:€|EUR)/;

const upperPlain = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase();

export interface ReceiptCheck { likely: boolean; hasDate: boolean; hasAmount: boolean; words: string[] }

export function checkReceipt(text: string, todayIso: IsoDate): ReceiptCheck {
  const plain = upperPlain(text);
  const tokens = new Set(plain.split(/[^\p{L}]+/u).filter(Boolean));
  const words = RECEIPT_WORDS.filter((w) => tokens.has(w));
  const hasDate = extractDates(text, todayIso).length > 0;
  const hasAmount = AMOUNT.test(plain);
  return { likely: hasDate && (hasAmount || words.length > 0), hasDate, hasAmount, words };
}
