/**
 * Γλώσσα εφαρμογής (κατάλογος: languages.ts).
 * Σύμβαση: το ελληνικό κείμενο μένει στον κώδικα ως κλειδί — `t('Βιβλιοθήκη')`, `t('{n} προϊόντα', { n })`. Κάθε άλλη
 * γλώσσα έχει λεξικό `<code>.ts` με τα ΙΔΙΑ ελληνικά κλειδιά· φορτώνεται μόνο το λεξικό της επιλεγμένης γλώσσας, με
 * `loadLanguage()` πριν από την πρώτη οθόνη. Αν λείπει μετάφραση εμφανίζεται το ελληνικό (ποτέ κενό)· το CI ελέγχει ότι
 * δεν λείπει καμία (`npm run test:i18n`). Η αλλαγή γλώσσας ξαναφορτώνει την εφαρμογή.
 */
import { LANG_INFO, isLang, pickLang, type Lang } from './languages';

export { LANGS, LANG_INFO, type Lang } from './languages';
type Dict = Record<string, string>;
const KEY = 'manuals-lang-v1';

/** Τα λεξικά ως ξεχωριστά κομμάτια του build: φορτώνεται μόνο εκείνο της επιλεγμένης γλώσσας. */
const LOADERS: Record<Exclude<Lang, 'el'>, () => Promise<{ default: Dict }>> = {
  en: () => import('./en'),
  fr: () => import('./fr'),
  es: () => import('./es'),
  it: () => import('./it'),
  de: () => import('./de'),
};

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (isLang(saved)) return saved;
  } catch { /* χωρίς αποθήκευση */ }
  const nav = typeof navigator !== 'undefined' ? [...(navigator.languages ?? []), navigator.language].filter(Boolean) : [];
  return pickLang(nav);
}

const lang: Lang = detect();
if (typeof document !== 'undefined') document.documentElement.lang = lang;
export const getLang = (): Lang => lang;
let dict: Dict = {};

/** Φορτώνει το λεξικό της τρέχουσας γλώσσας· μία φορά, πριν από την πρώτη οθόνη. Σε αποτυχία μένουν τα ελληνικά. */
export async function loadLanguage(): Promise<void> {
  if (lang === 'el') return; // η γλώσσα-πηγή δεν έχει λεξικό
  dict = (await LOADERS[lang]().catch(() => ({ default: {} }))).default;
}

export function setLang(l: Lang): void {
  try { localStorage.setItem(KEY, l); } catch { /* χωρίς αποθήκευση */ }
  if (l !== lang) location.reload();
}

const fill = (s: string, vars?: Record<string, string | number>) =>
  vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;

/** Μετάφραση: ελληνικό κείμενο → τρέχουσα γλώσσα, με {μεταβλητές}. */
export function t(el: string, vars?: Record<string, string | number>): string {
  return fill(dict[el] ?? el, vars);
}

export const locale = () => LANG_INFO[lang].locale;
const plural = new Intl.PluralRules(LANG_INFO[lang].locale);
/** Ενικός/πληθυντικός με τους κανόνες της γλώσσας (στα γαλλικά και το 0 παίρνει ενικό): tn(n, '{n} προϊόν', '{n} προϊόντα'). */
export const tn = (n: number, one: string, many: string) => t(plural.select(n) === 'one' ? one : many, { n });

/** «ΕΕΕΕ-ΜΜ-ΗΗ» → «14 Μαρ 2025». */
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}
export const fmtPercent = (v: number) => new Intl.NumberFormat(locale(), { style: 'percent', maximumFractionDigits: 0 }).format(v);

/** Οι γλώσσες του χρήστη κατά σειρά προτίμησης: της συσκευής, και στο τέλος της εφαρμογής. */
export function userLanguages(): string[] {
  const nav = typeof navigator !== 'undefined' ? [...(navigator.languages ?? []), navigator.language].filter(Boolean) : [];
  return [...nav, lang];
}
/** Όνομα γλώσσας στη γλώσσα της εφαρμογής: 'de' → «Γερμανικά» / «German». */
export function languageName(code: string): string {
  try { return new Intl.DisplayNames([locale()], { type: 'language' }).of(code) ?? code; } catch { return code; }
}
