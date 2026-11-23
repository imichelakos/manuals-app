/**
 * Πρόταση κατηγορίας για ένα προϊόν, από ό,τι ξέρουμε γι' αυτό — με σειρά αξιοπιστίας:
 *  1. το όνομα («Πλυντήριο ρούχων» → Πλύσιμο), με τις λέξεις-κλειδιά του categories.ts·
 *  2. η βιβλιοθήκη του χρήστη: άλλο προϊόν της ίδιας μάρκας με παρόμοιο μοντέλο (ίδια σειρά, π.χ. WAU28… / WAU24…),
 *     αλλιώς η κατηγορία όπου βάζει ο χρήστης τη μάρκα σχεδόν πάντα·
 *  3. το κείμενο του εντύπου (OCR).
 * null: τίποτα αρκετά σίγουρο — ο χρήστης διαλέγει μόνος του.
 */
import type { CategoryId } from './categories';
import type { Item } from './model';
import { findCategory } from './identify';

export interface CategoryClues { id?: string; name: string; brand: string; model: string; ocrText?: string }

const key = (s: string) => s.trim().toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
/** κοινό πρόθεμα κωδικού μοντέλου: τουλάχιστον 3 χαρακτήρες με ένα γράμμα — αρκετό για «ίδια σειρά» */
const sameSeries = (a: string, b: string) => {
  const x = key(a), y = key(b);
  let n = 0;
  while (n < x.length && n < y.length && x[n] === y[n]) n++;
  return n >= 3 && /\p{L}/u.test(x.slice(0, n));
};

export function suggestCategory(p: CategoryClues, library: readonly Item[]): CategoryId | null {
  const byName = findCategory(p.name).category;
  if (byName !== 'other') return byName;

  const brand = key(p.brand);
  if (brand) {
    const same = library.filter((i) => !i.deleted && i.id !== p.id && i.category !== 'other' && key(i.brand) === brand);
    const series = p.model.trim() ? same.find((i) => sameSeries(i.model, p.model)) : undefined;
    if (series) return series.category;
    if (same.length) {
      const counts = new Map<CategoryId, number>();
      for (const i of same) counts.set(i.category, (counts.get(i.category) ?? 0) + 1);
      const [top, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]!;
      if (n / same.length >= 2 / 3) return top;
    }
  }

  const byText = p.ocrText ? findCategory(p.ocrText).category : 'other';
  return byText !== 'other' ? byText : null;
}
