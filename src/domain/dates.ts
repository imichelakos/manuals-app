/**
 * Ημερομηνίες ημερολογίου ως «ΕΕΕΕ-ΜΜ-ΗΗ». Όλες οι πράξεις γίνονται πάνω στα μέρη (έτος, μήνας, ημέρα) και σε UTC,
 * ώστε να μην μετακινούνται με τη ζώνη ώρας ή την αλλαγή θερινής ώρας.
 */
export type IsoDate = string;

const pad = (n: number) => String(n).padStart(2, '0');
export const toIso = (y: number, m: number, d: number): IsoDate => `${y}-${pad(m)}-${pad(d)}`;

export function parseIso(s: IsoDate): { y: number; m: number; d: number } | null {
  const r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!r) return null;
  const y = +r[1]!, m = +r[2]!, d = +r[3]!;
  return isValid(y, m, d) ? { y, m, d } : null;
}

const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
export const isValid = (y: number, m: number, d: number) => m >= 1 && m <= 12 && d >= 1 && d <= daysIn(y, m);

/** Η σημερινή ημέρα στο ημερολόγιο της συσκευής. */
export function today(now: Date = new Date()): IsoDate {
  return toIso(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** +n μήνες· αν η ημέρα δεν υπάρχει στον μήνα-στόχο (31 → Φεβρουάριος) πάει στην τελευταία του. */
export function addMonths(s: IsoDate, n: number): IsoDate | null {
  const p = parseIso(s);
  if (!p) return null;
  const idx = p.y * 12 + (p.m - 1) + n;
  const y = Math.floor(idx / 12), m = (idx % 12 + 12) % 12 + 1;
  return toIso(y, m, Math.min(p.d, daysIn(y, m)));
}

/** +n ημέρες (αρνητικό: πίσω). */
export function addDays(s: IsoDate, n: number): IsoDate | null {
  const p = parseIso(s);
  if (!p) return null;
  const d = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
  return toIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Ημέρες από το a έως το b (θετικό όταν το b είναι μετά). */
export function daysBetween(a: IsoDate, b: IsoDate): number | null {
  const x = parseIso(a), y = parseIso(b);
  if (!x || !y) return null;
  return Math.round((Date.UTC(y.y, y.m - 1, y.d) - Date.UTC(x.y, x.m - 1, x.d)) / 86_400_000);
}
