/**
 * Γλώσσα εφαρμογής: ελληνικά (πηγή) ή αγγλικά.
 * Σύμβαση: το ελληνικό κείμενο μένει στον κώδικα ως κλειδί — `t('Βιβλιοθήκη')`, `t('{n} προϊόντα', { n })`. Τα αγγλικά
 * βρίσκονται στο en.ts με το ΙΔΙΟ ελληνικό κλειδί· αν λείπει μετάφραση εμφανίζεται το ελληνικό (ποτέ κενό).
 * Η αλλαγή γλώσσας ξαναφορτώνει την εφαρμογή, ώστε κάθε κείμενο να ενημερωθεί.
 */
import EN from './en';

export type Lang = 'el' | 'en';
const KEY = 'manuals-lang-v1';

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'el' || saved === 'en') return saved;
  } catch { /* χωρίς αποθήκευση */ }
  const nav = typeof navigator !== 'undefined' ? (navigator.languages?.[0] ?? navigator.language ?? 'el') : 'el';
  return nav.toLowerCase().startsWith('el') ? 'el' : 'en';
}

const lang: Lang = detect();
if (typeof document !== 'undefined') document.documentElement.lang = lang;
export const getLang = (): Lang => lang;

export function setLang(l: Lang): void {
  try { localStorage.setItem(KEY, l); } catch { /* χωρίς αποθήκευση */ }
  if (l !== lang) location.reload();
}

const fill = (s: string, vars?: Record<string, string | number>) =>
  vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;

/** Μετάφραση: ελληνικό κείμενο → τρέχουσα γλώσσα, με {μεταβλητές}. */
export function t(el: string, vars?: Record<string, string | number>): string {
  return fill(lang === 'el' ? el : (EN[el] ?? el), vars);
}
/** Ενικός/πληθυντικός: tn(n, '{n} προϊόν', '{n} προϊόντα'). */
export const tn = (n: number, one: string, many: string) => t(n === 1 ? one : many, { n });

const locale = () => (lang === 'en' ? 'en-GB' : 'el-GR');
/** «ΕΕΕΕ-ΜΜ-ΗΗ» → «14 Μαρ 2025». */
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}
export const fmtMoney = (v: number) => new Intl.NumberFormat(locale(), { style: 'currency', currency: 'EUR' }).format(v);
