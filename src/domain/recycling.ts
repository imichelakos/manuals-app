/**
 * Δείκτες ανακύκλωσης της βιβλιοθήκης: πόσα έντυπα ανακυκλώθηκαν, πόσα είναι έτοιμα (υπάρχει το ψηφιακό αλλά το χαρτί
 * κρατιέται ακόμη) και πόσα περιμένουν ψηφιακό· σελίδες σε ψηφιακή μορφή και ΕΚΤΙΜΗΣΗ βάρους του χαρτιού που ανακυκλώθηκε.
 *
 * Βάρος: σελίδες του ψηφιακού εγχειριδίου → φύλλα τυπωμένα και από τις δύο όψεις → γραμμάρια ανά φύλλο A5 80 g/m²
 * (0,148 × 0,210 m × 80 g/m² ≈ 2,5 g). Υποθέσεις: το έντυπο είχε όσες σελίδες και το PDF, μέγεθος A5, χαρτί 80 g/m².
 * Χωρίς εκτίμηση CO2 (απόφαση 22/11/2026).
 */
import { hasDigitalManual, type Item } from './model';

/** γραμμάρια ανά φύλλο A5 80 g/m² (βλ. πάνω) */
export const SHEET_GRAMS = 2.5;

/** Σελίδες του εγχειριδίου: του PDF (το μεγαλύτερο, αν είναι πολλά), αλλιώς όσες σελίδες φωτογραφήθηκαν. */
export function manualPages(i: Item): number | undefined {
  const manuals = i.attachments.filter((a) => a.kind === 'manual' && a.pages);
  const pdf = manuals.filter((a) => a.mime === 'application/pdf').map((a) => a.pages!);
  if (pdf.length) return Math.max(...pdf);
  const photos = manuals.reduce((n, a) => n + a.pages!, 0);
  return photos || undefined;
}

export interface RecyclingStats {
  total: number;
  recycled: number;
  ready: number;
  waiting: number;
  /** ποσοστό 0–100 των προϊόντων με ανακυκλωμένο έντυπο (ακέραιο) */
  recycledPct: number;
  /** ποσοστό 0–100 των προϊόντων που έχουν ψηφιακό εγχειρίδιο */
  digitalPct: number;
  /** σελίδες εγχειριδίων σε ψηφιακή μορφή (όπου είναι γνωστό το πλήθος) */
  pagesDigital: number;
  /** εκτίμηση: γραμμάρια χαρτιού από τα ανακυκλωμένα έντυπα με γνωστό πλήθος σελίδων */
  paperGrams: number;
  /** ανακυκλωμένα έντυπα χωρίς γνωστό πλήθος σελίδων (δεν μετρούν στο βάρος) */
  paperUnknown: number;
}

export function recyclingStats(items: readonly Item[]): RecyclingStats {
  const live = items.filter((i) => !i.deleted);
  let recycled = 0, ready = 0, waiting = 0, digital = 0, pagesDigital = 0, paperGrams = 0, paperUnknown = 0;
  for (const i of live) {
    const has = hasDigitalManual(i);
    const pages = manualPages(i);
    if (pages) pagesDigital += pages;
    if (i.paper === 'recycled') { if (pages) paperGrams += Math.ceil(pages / 2) * SHEET_GRAMS; else paperUnknown++; }
    if (has) digital++;
    if (i.paper === 'recycled') recycled++;
    else if (has) ready++;
    else waiting++;
  }
  const pct = (n: number) => (live.length ? Math.round((n / live.length) * 100) : 0);
  return { total: live.length, recycled, ready, waiting, recycledPct: pct(recycled), digitalPct: pct(digital), pagesDigital, paperGrams, paperUnknown };
}
