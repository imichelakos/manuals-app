/**
 * Κανονικοποίηση κειμένου για αναζήτηση και αναγνώριση: πεζά, χωρίς τόνους/διαλυτικά, τελικό σίγμα → σ.
 * «Ψυγείο», «ΨΥΓΕΙΟ», «ψυγειο» δίνουν το ίδιο αποτέλεσμα.
 */
export function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/ς/g, 'σ');
}

const GR: Record<string, string> = {
  α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x',
  ο: 'o', π: 'p', ρ: 'r', σ: 's', τ: 't', υ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o',
};
/** Κανονικοποιημένο ελληνικό → λατινικοί χαρακτήρες («ψυγειο» → «psygeio»), ώστε να βρίσκεται και με λατινικό πληκτρολόγιο. */
export function latin(normalized: string): string {
  let out = '';
  for (const ch of normalized) out += GR[ch] ?? ch;
  return out;
}
export const hasGreek = (s: string) => /[Ͱ-Ͽ]/.test(s);

/** Λέξεις (γράμματα/ψηφία) ενός κανονικοποιημένου κειμένου. */
export function words(normalized: string): string[] {
  return normalized.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/** Απόσταση επεξεργασίας ≤ 1 (μία αλλαγή, προσθήκη, αφαίρεση ή αντιμετάθεση γειτονικών) — για ανοχή σε λάθη πληκτρολόγησης. */
export function within1(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  while (i < la && i < lb && a[i] === b[i]) i++;
  if (la === lb) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true; // αλλαγή ενός χαρακτήρα
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2); // αντιμετάθεση
  }
  const [long, shorter] = la > lb ? [a, b] : [b, a];
  return long.slice(i + 1) === shorter.slice(i); // προσθήκη/αφαίρεση
}
