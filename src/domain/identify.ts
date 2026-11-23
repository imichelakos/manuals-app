/**
 * Αναγνώριση προϊόντος από το κείμενο του εξωφύλλου (OCR) και τους συνδέσμους των QR: μάρκα, πιθανά μοντέλα, κατηγορία.
 * Είναι ΠΡΟΤΑΣΕΙΣ — το OCR κάνει λάθη· ο χρήστης τις βλέπει και τις διορθώνει πριν αποθηκευτεί οτιδήποτε.
 */
import { BRANDS } from './brands';
import { CATEGORIES, type CategoryId } from './categories';
import { norm } from './text';

export interface Identification {
  /** μάρκες που βρέθηκαν, η πιθανότερη πρώτη */
  brands: string[];
  /** πιθανοί κωδικοί μοντέλου, ο πιθανότερος πρώτος (έως 6) */
  models: string[];
  category: CategoryId;
  /** λέξη που περιγράφει το είδος όπως γράφεται στο έντυπο (π.χ. «Ψυγειοκαταψύκτης»), αν βρέθηκε */
  productWord: string;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** ολόκληρη λέξη/φράση μέσα σε κανονικοποιημένο κείμενο (όρια: όχι γράμμα/ψηφίο) */
const wholeWord = (needle: string) => new RegExp(`(?<![\\p{L}\\p{N}])${esc(needle)}(?![\\p{L}\\p{N}])`, 'u');

/** Το κομμάτι του αρχικού κειμένου που αντιστοιχεί στη θέση `at` του κανονικοποιημένου (ίδιο μήκος όταν το κείμενο είναι NFC). */
function printed(text: string, at: number, len: number): string | null {
  const nfc = text.normalize('NFC');
  return norm(nfc).length === nfc.length ? nfc.slice(at, at + len) : null;
}

function findBrands(text: string, urls: string[]): string[] {
  const n = norm(text);
  const found: { brand: string; at: number; boost: number }[] = [];
  for (const brand of BRANDS) {
    const key = norm(brand);
    let at = n.search(wholeWord(key));
    // πολλές μάρκες είναι και κοινές λέξεις (Brother, Sharp, Apple): μετρά μόνο αν είναι τυπωμένη με κεφαλαίο αρχικό
    if (at >= 0 && /^\p{Ll}/u.test(printed(text, at, key.length) ?? brand) && !/^\p{Ll}/u.test(brand)) at = -1;
    // όνομα μάρκας μέσα στη διεύθυνση ενός QR (π.χ. samsung.com) — πιο αξιόπιστο από το OCR
    const slug = key.replace(/[^a-z0-9]/g, '');
    const inUrl = slug.length >= 4 && urls.some((u) => hostLabels(u).includes(slug));
    if (at >= 0 || inUrl) found.push({ brand, at: at >= 0 ? at : Number.MAX_SAFE_INTEGER, boost: inUrl ? 1 : 0 });
  }
  return found.sort((a, b) => b.boost - a.boost || a.at - b.at).map((f) => f.brand);
}

function hostLabels(url: string): string[] {
  try { return new URL(url).hostname.toLowerCase().split('.'); } catch { return []; }
}

const LABEL = /^(model|modell|modele|modelo|modello|mod|type|typ|tipo|art|ref|μοντελο|τυποσ|κωδικοσ)$/;
const UNIT = /^\d+([.,/-]\d+)*(V|W|KW|HZ|KG|G|MM|CM|M|ML|L|A|MA|MAH|AH|DB|BAR|RPM|PSI|KWH|VA|VAC|VDC|BTU|GB|TB|MB)$/;
const STANDARD = /^(EN|IEC|ISO|DIN|IP|IPX|EC|CE|EU|UL|BS)[-]?\d|^\d{2,4}\/\d+\/(EU|EC|EE|EEC|ΕΕ|ΕΚ)$|^(WEEE|ROHS|WIFI|WI-FI|USB\d?|HDMI\d?|UHD|4K|8K|A\+{1,3}|LED|LCD|OLED|QLED)$/;

function findModels(text: string): string[] {
  const raw = text.split(/\s+/).filter(Boolean);
  const scores = new Map<string, number>();
  raw.forEach((tok, idx) => {
    const t = tok.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''); // χωρίς στίξη στις άκρες
    if (t.length < 4 || t.length > 20) return;
    if (!/^[A-Z0-9][A-Z0-9\-/.]*$/.test(t)) return; // κεφαλαία λατινικά, ψηφία, παύλα, κάθετος, τελεία
    const letters = (t.match(/[A-Z]/g) ?? []).length, digits = (t.match(/\d/g) ?? []).length;
    if (!letters || !digits) return;            // ούτε σκέτη λέξη ούτε σκέτος αριθμός
    if (UNIT.test(t) || STANDARD.test(t)) return; // 230V, 50HZ, EN60335, 2012/19/EU …
    let s = 1;
    if (t.length >= 6 && t.length <= 14) s += 2;
    if (letters >= 2 && digits >= 2) s += 1;
    // ετικέτα «Model:», «Μοντέλο», «Type» λίγο πριν
    for (let k = 1; k <= 2; k++) { const prev = raw[idx - k]; if (prev && LABEL.test(norm(prev).replace(/[^\p{L}]/gu, ''))) { s += 5; break; } }
    scores.set(t, Math.max(scores.get(t) ?? 0, s) + (scores.has(t) ? 1 : 0)); // επανάληψη στο κείμενο: +1
  });
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => t);
}

export function findCategory(text: string): { category: CategoryId; productWord: string } {
  const n = norm(text);
  let best: { category: CategoryId; hits: number; word: string; at: number } | null = null;
  for (const c of CATEGORIES) {
    let hits = 0, first = -1, word = '';
    for (const raw of c.words) {
      const w = norm(raw); // οι λέξεις-κλειδιά γράφονται ελεύθερα· κανονικοποιούνται εδώ (τελικό σίγμα, τόνοι)
      const at = n.search(wholeWord(w));
      if (at < 0) continue;
      hits++;
      if (first < 0 || at < first) { first = at; word = w; }
    }
    if (hits && (!best || hits > best.hits)) best = { category: c.id, hits, word, at: first };
  }
  if (!best) return { category: 'other', productWord: '' };
  // η λέξη όπως είναι τυπωμένη (με τόνους/κεφαλαία): το norm() κρατά το μήκος όταν το κείμενο είναι NFC
  const slice = printed(text, best.at, best.word.length) ?? best.word;
  return { category: best.category, productWord: slice.charAt(0).toUpperCase() + slice.slice(1).toLowerCase() };
}

/** Κείμενο του εξωφύλλου ανά πέρασμα OCR: `latin` από το αγγλικό μοντέλο (μάρκες, κωδικοί), `greek` από το ελληνικό. */
export interface CoverText { latin: string; greek: string }

/** λέξεις που ακολουθούν συχνά τη μάρκα σε εξώφυλλο και δεν είναι μοντέλο */
const NOT_MODEL = /^(owner|owners|manual|user|users|guide|handbook|instruction|instructions|quick|start|service|warranty|book|the|and|for|by|group|motor|motors|automobiles|cars|ag|sa|gmbh|inc|ltd|company|co)$/i;

/**
 * Οχήματα: το μοντέλο είναι όνομα («Corolla», «Golf», «Model 3»), όχι κωδικός. Παίρνει τη λέξη (ή τις δύο, αν η δεύτερη
 * είναι σύντομη, π.χ. «Model 3», «ID.3») που ακολουθεί τη μάρκα, όταν αρχίζει με κεφαλαίο και δεν είναι γενική λέξη.
 */
function namedModels(text: string, brand: string): string[] {
  const out: string[] = [];
  const re = new RegExp(`${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+([A-Z][\\p{L}\\p{N}.-]{1,19})(?:\\s+([\\p{L}\\p{N}.-]{1,4}))?`, 'giu'); // και «TOYOTA COROLLA»
  for (const m of text.matchAll(re)) {
    const first = m[1]!, second = m[2];
    if (!/^\p{Lu}/u.test(first) || NOT_MODEL.test(first)) continue;
    const name = second && /\d/.test(second) && !NOT_MODEL.test(second) ? `${first} ${second}` : first;
    if (!out.includes(name)) out.push(name);
  }
  return out;
}

/** `categoryHint`: κατηγορία που βρέθηκε αλλού (π.χ. στις επόμενες σελίδες ενός PDF), όταν αυτό το κείμενο δεν δείχνει καμία. */
export function identify(text: CoverText, urls: string[] = [], categoryHint?: CategoryId): Identification {
  // μάρκα και μοντέλο ΜΟΝΟ από το λατινικό πέρασμα (το ελληνικό παραμορφώνει τους κωδικούς)· το είδος και από τα δύο
  const brands = findBrands(text.latin, urls);
  const own = findCategory(`${text.greek}\n${text.latin}`);
  const kind = own.category === 'other' && categoryHint ? { ...own, category: categoryHint } : own;
  let models = findModels(text.latin);
  // όχημα: πρώτα το όνομα μοντέλου μετά τη μάρκα, μετά τυχόν κωδικοί
  if (kind.category === 'vehicle' && brands[0]) models = [...new Set([...namedModels(text.latin, brands[0]), ...models])].slice(0, 6);
  return { brands, models, ...kind };
}
