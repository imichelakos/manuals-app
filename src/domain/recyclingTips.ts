/**
 * Συμβουλές για το τέλος ζωής μιας συσκευής, ανά περιοχή, ομάδα και είδος. Επιστρέφει ΜΟΝΟ ids και πηγές· τα κείμενα
 * (μεταφράσιμα) είναι στην οθόνη (components/item/RecyclingTips). Κάθε συμβουλή με ισχυρισμό έχει πρωτογενή πηγή:
 *  - ΕΕ: Οδηγία 2012/19/ΕΕ (ΑΗΗΕ) — άρθρο 5 §2 (επιστροφή σε καταστήματα), Παράρτημα VII (επικίνδυνα μέρη), Παράρτημα IX (σύμβολο).
 *  - Ελλάδα: Ανακύκλωση Συσκευών Α.Ε. (εγκεκριμένο σύστημα ΑΗΗΕ από τον ΕΟΑΝ), ΑΦΗΣ (φορητές μπαταρίες).
 *  - Υπόλοιπος κόσμος: U.S. EPA, «Electronics Donation and Recycling».
 * Επαληθεύτηκαν 22/11/2026. Η Οδηγία επιτρέπει εθνικές παρεκκλίσεις (άρθρο 5 §2β, §2γ): γι' αυτό τα κείμενα λένε «κατά κανόνα».
 */
import type { CategoryId } from './categories';
import type { GroupId } from './groups';

export type RecyclingRegion = 'gr' | 'eu' | 'world';
export type TipId =
  | 'reuse' | 'symbol' | 'oneToOne' | 'smallZeroToOne' | 'cooling' | 'lamps' | 'batteries' | 'lithium' | 'data'
  | 'grPoints' | 'grBatteries' | 'worldTakeBack' | 'unpowered';
export type SourceId = 'art5' | 'annex7' | 'annex9' | 'electrocycle' | 'afis' | 'epa';
export interface Tip { id: TipId; source?: SourceId }

/** Διευθύνσεις των πηγών (οι ετικέτες, μεταφράσιμες, είναι στην οθόνη). Το EUR-Lex δέχεται τη γλώσσα στη διεύθυνση. */
export function sourceUrl(id: SourceId, lang: 'el' | 'en'): string {
  switch (id) {
    case 'art5': case 'annex7': case 'annex9': return `https://eur-lex.europa.eu/legal-content/${lang.toUpperCase()}/TXT/HTML/?uri=CELEX:32012L0019`;
    case 'electrocycle': return 'https://www.electrocycle.gr/simeia-anakiklosis-syskevon/';
    case 'afis': return 'https://afis.gr/poy-tha-vreis-kado-afis/';
    case 'epa': return 'https://www.epa.gov/recycle/electronics-donation-and-recycling';
  }
}

const EU = new Set(['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE']);

/** Περιοχή από τις γλώσσες/περιοχές της συσκευής (π.χ. «el-GR» → gr, «de-AT» → eu, «en-US» → world). */
export function regionFromLocales(tags: readonly string[]): RecyclingRegion {
  for (const tag of tags) {
    const [lang, region] = tag.split(/[-_]/);
    const r = region?.toUpperCase();
    if (r === 'GR') return 'gr';
    if (r && /^[A-Z]{2}$/.test(r)) return EU.has(r) ? 'eu' : 'world';
    if (lang?.toLowerCase() === 'el') return 'gr'; // «el» χωρίς περιοχή: πιθανότατα Ελλάδα
  }
  return 'world';
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
const has = (name: string, words: string[]) => words.some((w) => norm(name).includes(w));
const COOLING = ['ψυγει', 'καταψυκτ', 'κλιματιστικ', 'αφυγραντ', 'αντλια θερμοτητας', 'fridge', 'freezer', 'refrigerator', 'air condition', 'dehumidifier', 'heat pump'];
const LAMPS = ['λαμπ', 'φωτιστικ', 'lamp', 'bulb'];

export function recyclingTips(p: { name: string; category: CategoryId; group: GroupId | null }, region: RecyclingRegion): Tip[] {
  if (p.group === 'unpowered') return [{ id: 'reuse' }, { id: 'unpowered' }];
  const tips: Tip[] = [{ id: 'reuse', source: region === 'world' ? 'epa' : undefined }];
  const inEu = region !== 'world';
  if (inEu) tips.push({ id: 'symbol', source: 'annex9' });
  if (has(p.name, COOLING)) tips.push({ id: 'cooling', source: 'annex7' });
  if (has(p.name, LAMPS)) tips.push({ id: 'lamps', source: 'annex7' });
  if (p.group === 'electronics') tips.push({ id: 'data', source: 'epa' });
  tips.push({ id: 'batteries', source: 'epa' }, { id: 'lithium', source: 'epa' });
  if (inEu) {
    tips.push({ id: 'oneToOne', source: 'art5' });
    if (p.group !== 'large') tips.push({ id: 'smallZeroToOne', source: 'art5' });
  }
  if (region === 'gr') tips.push({ id: 'grPoints', source: 'electrocycle' }, { id: 'grBatteries', source: 'afis' });
  if (region === 'world') tips.push({ id: 'worldTakeBack', source: 'epa' });
  return tips;
}
