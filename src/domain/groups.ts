/**
 * Ομάδες προϊόντων: απλή, ανώτερη διάκριση πάνω από τις κατηγορίες, για φίλτρα και (αργότερα) συμβουλές ανακύκλωσης.
 * Δεν αντιστοιχούν ένα-προς-ένα με τις κατηγορίες (η «Κουζίνα» έχει ψυγείο και βραστήρα), γι' αυτό η ομάδα προτείνεται
 * ανά προϊόν από το όνομα και την κατηγορία· ο χρήστης μπορεί να την αλλάξει (item.group).
 */
import type { CategoryId } from './categories';

export const GROUP_IDS = ['large', 'small', 'electronics', 'unpowered'] as const;
export type GroupId = (typeof GROUP_IDS)[number];

export const GROUP_LABELS: Record<GroupId, string> = {
  large: 'Μεγάλες συσκευές',
  small: 'Μικρές συσκευές',
  electronics: 'Ηλεκτρονικά',
  unpowered: 'Χωρίς ρεύμα',
};

/** λέξεις (κανονικοποιημένες: πεζά, χωρίς τόνους) που κρίνουν την ομάδα ανεξάρτητα από την κατηγορία */
const WORDS: Record<GroupId, string[]> = {
  large: ['ψυγειο', 'καταψυκτ', 'πλυντηριο', 'στεγνωτηριο', 'φουρνο', 'κουζινα', 'κλιματιστικ', 'θερμοσιφων', 'λεβητα', 'αντλια θερμοτητας',
    'refrigerator', 'fridge', 'freezer', 'washing machine', 'washer', 'dryer', 'dishwasher', 'oven', 'cooker', 'range', 'air conditioner', 'boiler', 'heat pump'],
  electronics: ['τηλεορασ', 'κινητο', 'υπολογιστ', 'οθονη', 'εκτυπωτ', 'κονσολα', 'καμερα', 'ακουστικ', 'ηχει', 'ρουτερ', 'ταμπλετ',
    'television', 'tv', 'phone', 'smartphone', 'laptop', 'notebook', 'computer', 'tablet', 'monitor', 'printer', 'router', 'modem', 'console',
    'camera', 'headphones', 'earbuds', 'speaker', 'soundbar', 'smartwatch', 'watch', 'projector'],
  unpowered: ['επιπλο', 'ντουλαπα', 'κρεβατι', 'καρεκλα', 'ραφι', 'καροτσι', 'καθισμα αυτοκινητου',
    'furniture', 'wardrobe', 'bed', 'chair', 'shelf', 'desk', 'stroller', 'car seat'],
  small: [],
};

/** ομάδα όταν το όνομα δεν λέει κάτι — από την κατηγορία· null: δεν ξέρουμε (όχημα, «άλλο») */
const BY_CATEGORY: Record<CategoryId, GroupId | null> = {
  kitchen: 'small', laundry: 'small', climate: 'small', tools: 'small', care: 'small',
  av: 'electronics', computing: 'electronics', smart: 'electronics',
  furniture: 'unpowered', kids: null, vehicle: null, other: null,
};

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/ς/g, 'σ');

export function suggestGroup(p: { name: string; category: CategoryId; ocrText?: string }): GroupId | null {
  const name = ` ${norm(p.name)} `;
  // σειρά: μεγάλες συσκευές πρώτα («πλυντήριο πιάτων» ≠ μικρή συσκευή), μετά ηλεκτρονικά, μετά χωρίς ρεύμα
  for (const g of ['large', 'electronics', 'unpowered'] as const) {
    if (WORDS[g].some((w) => new RegExp(`[^\\p{L}]${norm(w)}`, 'u').test(name))) return g;
  }
  return BY_CATEGORY[p.category];
}

/** Η ομάδα που ισχύει: του χρήστη, αλλιώς η πρόταση. */
export const groupOf = (i: { group?: GroupId; name: string; category: CategoryId }): GroupId | null => i.group ?? suggestGroup(i);
