/**
 * Αναζήτηση και φίλτρα πάνω στη βιβλιοθήκη — όλα στη μνήμη, καθαρές συναρτήσεις.
 *
 * Κάθε λέξη της αναζήτησης πρέπει να ταιριάζει κάπου στο προϊόν (ΚΑΙ). Ταίριασμα, από το ισχυρότερο:
 * ίδια λέξη → αρχή λέξης → μέσα σε λέξη → ένα λάθος πληκτρολόγησης. Αγνοούνται τόνοι/κεφαλαία· ελληνική λέξη βρίσκεται
 * και με λατινικούς χαρακτήρες («psyg» → «Ψυγείο»)· κωδικοί μοντέλου βρίσκονται και χωρίς παύλες/κενά («rb34» → «RB-34 T»).
 */
import { categoryById, type CategoryId } from './categories';
import { displayName, hasDigitalManual, hasReceipt, type Item } from './model';
import { hasGreek, latin, norm, within1, words } from './text';
import { warrantyInfo, type WarrantyState } from './warranty';
import type { IsoDate } from './dates';

export type YesNo = 'any' | 'yes' | 'no';
export interface Filters {
  categories: CategoryId[];
  warranty: WarrantyState[];
  manual: YesNo;
  receipt: YesNo;
  paper: 'any' | 'kept' | 'recycled';
  rooms: string[];
  tags: string[];
}
export const NO_FILTERS: Filters = { categories: [], warranty: [], manual: 'any', receipt: 'any', paper: 'any', rooms: [], tags: [] };
export const activeFilterCount = (f: Filters): number =>
  f.categories.length + f.warranty.length + f.rooms.length + f.tags.length + +(f.manual !== 'any') + +(f.receipt !== 'any') + +(f.paper !== 'any');

export type Sort = 'relevance' | 'recent' | 'name' | 'warranty';

interface Field { tokens: string[]; weight: number }
interface Entry { item: Item; fields: Field[]; compact: string; name: string }
export interface SearchIndex { entries: Entry[] }

const tokensOf = (text: string): string[] => {
  const base = words(norm(text));
  const out = new Set(base);
  for (const w of base) if (hasGreek(w)) out.add(latin(w));
  return [...out];
};
const compactOf = (s: string) => norm(s).replace(/[^\p{L}\p{N}]+/gu, '');

/** Ευρετήριο: φτιάχνεται μία φορά ανά αλλαγή της βιβλιοθήκης, όχι σε κάθε πλήκτρο. */
export function buildIndex(items: Item[]): SearchIndex {
  return {
    entries: items.filter((i) => !i.deleted).map((item) => {
      const f = (text: string, weight: number): Field => ({ tokens: tokensOf(text), weight });
      return {
        item,
        name: norm(displayName(item)),
        compact: [item.model, item.serial, item.ean ?? ''].map(compactOf).filter(Boolean).join(' '),
        fields: [
          f(item.name, 5), f(item.model, 5), f(item.brand, 4),
          f(item.tags.join(' '), 3), f(item.serial, 3), f(item.ean ?? '', 3),
          f(categoryById(item.category).label, 2), f(item.room, 2), f(item.purchase.store ?? '', 2),
          f(item.notes, 1.5), f(item.warranty.note ?? '', 1),
          f(item.links.map((l) => l.title).join(' '), 1), f(item.attachments.map((a) => a.name).join(' '), 1),
          f(item.ocrText ?? '', 0.5),
        ].filter((x) => x.tokens.length),
      };
    }),
  };
}

function tokenMatch(q: string, token: string): number {
  if (token === q) return 1;
  if (token.startsWith(q)) return 0.7;
  if (q.length >= 3 && token.includes(q)) return 0.4;
  // ένα λάθος: απέναντι σε ολόκληρη τη λέξη ή στην αρχή της (ο χρήστης γράφει ακόμη)
  if (q.length >= 5 && (within1(q, token) || within1(q, token.slice(0, q.length)))) return 0.3;
  return 0;
}

/** Βαθμός συνάφειας ενός προϊόντος για την αναζήτηση· 0 = δεν ταιριάζει. */
function score(e: Entry, qTokens: string[], qCompact: string): number {
  let total = 0;
  for (const q of qTokens) {
    let best = 0;
    for (const f of e.fields) for (const t of f.tokens) {
      const m = tokenMatch(q, t) * f.weight;
      if (m > best) best = m;
    }
    if (best === 0) { total = 0; break; }
    total += best;
  }
  // κωδικός γραμμένος με άλλα διαχωριστικά: «rb 34 t» ↔ «RB34T»
  if (total === 0 && qCompact.length >= 3 && e.compact.includes(qCompact)) total = 3;
  return total;
}

const yesNo = (want: YesNo, has: boolean) => want === 'any' || (want === 'yes') === has;

/** Ομάδες φίλτρων: μέσα στην ομάδα Ή, μεταξύ ομάδων ΚΑΙ. `skip`: ομάδα που αγνοείται (για τα πλήθη των επιλογών της). */
function passes(i: Item, f: Filters, todayIso: IsoDate, skip?: keyof Filters): boolean {
  if (skip !== 'categories' && f.categories.length && !f.categories.includes(i.category)) return false;
  if (skip !== 'warranty' && f.warranty.length && !f.warranty.includes(warrantyInfo(i, todayIso).state)) return false;
  if (skip !== 'manual' && !yesNo(f.manual, hasDigitalManual(i))) return false;
  if (skip !== 'receipt' && !yesNo(f.receipt, hasReceipt(i))) return false;
  if (skip !== 'paper' && f.paper !== 'any' && i.paper !== f.paper) return false;
  if (skip !== 'rooms' && f.rooms.length && !f.rooms.includes(i.room)) return false;
  if (skip !== 'tags' && f.tags.length && !f.tags.some((t) => i.tags.includes(t))) return false;
  return true;
}

function matching(index: SearchIndex, query: string): { e: Entry; s: number }[] {
  const qTokens = words(norm(query));
  if (!qTokens.length) return index.entries.map((e) => ({ e, s: 0 }));
  const qCompact = compactOf(query);
  const out: { e: Entry; s: number }[] = [];
  for (const e of index.entries) { const s = score(e, qTokens, qCompact); if (s > 0) out.push({ e, s }); }
  return out;
}

export interface SearchParams { query: string; filters: Filters; sort: Sort; today: IsoDate }

export function search(index: SearchIndex, p: SearchParams): Item[] {
  const hits = matching(index, p.query).filter(({ e }) => passes(e.item, p.filters, p.today));
  const recent = (a: Entry, b: Entry) => b.item.updatedAt - a.item.updatedAt;
  const sort = p.sort === 'relevance' && !p.query.trim() ? 'recent' : p.sort;
  hits.sort((a, b) => {
    if (sort === 'relevance') return b.s - a.s || recent(a.e, b.e);
    if (sort === 'name') return a.e.name.localeCompare(b.e.name, 'el') || recent(a.e, b.e);
    if (sort === 'warranty') {
      // πρώτα όσα λήγουν νωρίτερα (και δεν έχουν λήξει), μετά τα ληγμένα, τελευταία όσα δεν έχουν εγγύηση
      const key = (e: Entry) => { const w = warrantyInfo(e.item, p.today); return w.daysLeft === null ? Infinity : w.daysLeft < 0 ? 1e9 - w.daysLeft : w.daysLeft; };
      return key(a.e) - key(b.e) || recent(a.e, b.e);
    }
    return recent(a.e, b.e);
  });
  return hits.map((h) => h.e.item);
}

export interface Facets {
  total: number;
  categories: Map<CategoryId, number>;
  warranty: Map<WarrantyState, number>;
  manual: { yes: number; no: number };
  receipt: { yes: number; no: number };
  paper: { kept: number; recycled: number };
  rooms: Map<string, number>;
  tags: Map<string, number>;
}

/** Πόσα προϊόντα θα έδινε κάθε επιλογή φίλτρου (με την τρέχουσα αναζήτηση και τα φίλτρα των ΑΛΛΩΝ ομάδων). */
export function facets(index: SearchIndex, p: Omit<SearchParams, 'sort'>): Facets {
  const items = matching(index, p.query).map((h) => h.e.item);
  const inc = <K>(m: Map<K, number>, k: K) => m.set(k, (m.get(k) ?? 0) + 1);
  const only = (skip: keyof Filters) => items.filter((i) => passes(i, p.filters, p.today, skip));
  const out: Facets = {
    total: items.filter((i) => passes(i, p.filters, p.today)).length,
    categories: new Map(), warranty: new Map(), manual: { yes: 0, no: 0 }, receipt: { yes: 0, no: 0 },
    paper: { kept: 0, recycled: 0 }, rooms: new Map(), tags: new Map(),
  };
  for (const i of only('categories')) inc(out.categories, i.category);
  for (const i of only('warranty')) inc(out.warranty, warrantyInfo(i, p.today).state);
  for (const i of only('manual')) out.manual[hasDigitalManual(i) ? 'yes' : 'no']++;
  for (const i of only('receipt')) out.receipt[hasReceipt(i) ? 'yes' : 'no']++;
  for (const i of only('paper')) out.paper[i.paper]++;
  for (const i of only('rooms')) if (i.room) inc(out.rooms, i.room);
  for (const i of only('tags')) for (const t of i.tags) inc(out.tags, t);
  return out;
}
