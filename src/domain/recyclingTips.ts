/**
 * Γενικές συμβουλές για το τέλος ζωής μιας συσκευής, ανά ομάδα και είδος — ίδιες σε κάθε χώρα (απόφαση 23/11/2026: οι
 * εκδοχές ανά περιοχή διέφεραν ελάχιστα). Επιστρέφει ΜΟΝΟ ids και πηγές· τα κείμενα (μεταφράσιμα) είναι στην οθόνη
 * (components/item/RecyclingTips). Πηγές (επαλήθευση 22/11/2026):
 *  - Οδηγία 2012/19/ΕΕ (ΑΗΗΕ): Παράρτημα VII (επικίνδυνα μέρη), άρθρο 14 και Παράρτημα IX (σύμβολο διαγραμμένου κάδου).
 *  - U.S. EPA, «Electronics Donation and Recycling»: δεδομένα, μπαταρίες, προγράμματα επιστροφής.
 */
import type { GroupId } from './groups';

export type TipId = 'reuse' | 'symbol' | 'cooling' | 'lamps' | 'data' | 'batteries' | 'lithium' | 'takeBack' | 'unpowered';
export type SourceId = 'annex7' | 'annex9' | 'epa';
export interface Tip { id: TipId; source?: SourceId }

/** Διευθύνσεις των πηγών (οι ετικέτες, μεταφράσιμες, είναι στην οθόνη). Το EUR-Lex δέχεται τη γλώσσα στη διεύθυνση. */
export function sourceUrl(id: SourceId, lang: 'el' | 'en'): string {
  return id === 'epa'
    ? 'https://www.epa.gov/recycle/electronics-donation-and-recycling'
    : `https://eur-lex.europa.eu/legal-content/${lang.toUpperCase()}/TXT/HTML/?uri=CELEX:32012L0019`;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
const has = (name: string, words: string[]) => words.some((w) => norm(name).includes(w));
const COOLING = ['ψυγει', 'καταψυκτ', 'κλιματιστικ', 'αφυγραντ', 'αντλια θερμοτητας', 'fridge', 'freezer', 'refrigerator', 'air condition', 'dehumidifier', 'heat pump'];
const LAMPS = ['λαμπ', 'φωτιστικ', 'lamp', 'bulb'];

export function recyclingTips(p: { name: string; group: GroupId | null }): Tip[] {
  if (p.group === 'unpowered') return [{ id: 'reuse' }, { id: 'unpowered' }];
  const tips: Tip[] = [{ id: 'reuse', source: 'epa' }, { id: 'symbol', source: 'annex9' }];
  if (has(p.name, COOLING)) tips.push({ id: 'cooling', source: 'annex7' });
  if (has(p.name, LAMPS)) tips.push({ id: 'lamps', source: 'annex7' });
  if (p.group === 'electronics') tips.push({ id: 'data', source: 'epa' });
  tips.push({ id: 'batteries', source: 'epa' }, { id: 'lithium', source: 'epa' }, { id: 'takeBack', source: 'epa' });
  return tips;
}
