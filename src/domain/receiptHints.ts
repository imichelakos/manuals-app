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
