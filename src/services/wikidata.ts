/**
 * Επιβεβαίωση μάρκας στο Wikidata (ανοιχτή βάση, δωρεάν, χωρίς κλειδί). Στέλνονται ΜΟΝΟ λέξεις του εξωφύλλου, ποτέ η
 * εικόνα, και μόνο με συγκατάθεση του χρήστη (Ρυθμίσεις → «Μάρκα από το διαδίκτυο»).
 * Κανόνες της Wikimedia (επαληθευμένοι 23/11/2026): αιτήματα ένα-ένα, όχι παράλληλα (API:Etiquette)· ανώνυμο CORS με
 * origin=* (API:Cross-site requests)· περιγραφικό Api-User-Agent με στοιχείο επικοινωνίας (User-Agent policy).
 */
import { brandQueries, describesBrand, sameWord } from '@/domain/brandLookup';

const API = 'https://www.wikidata.org/w/api.php';
// ΕΚΚΡΕΜΕΙ (ROADMAP): email επικοινωνίας της εφαρμογής, πριν από το App Store
const AGENT = 'Manuals/1.0 (contact pending)';
/** όριο αιτημάτων ανά σάρωση και χρόνου ανά αίτημα */
const MAX_REQUESTS = 15;
const TIMEOUT_MS = 4000;

export interface BrandMatch { brand: string; candidate: string; description: string; id: string }

interface SearchHit { id: string; label?: string; description?: string }

async function search(term: string): Promise<SearchHit[]> {
  const url = `${API}?action=wbsearchentities&format=json&type=item&language=en&uselang=en&limit=7&origin=*&search=${encodeURIComponent(term)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { headers: { 'Api-User-Agent': AGENT }, signal: ctrl.signal });
    if (!r.ok) return [];
    return ((await r.json()) as { search?: SearchHit[] }).search ?? [];
  } finally { clearTimeout(timer); }
}

/**
 * Πρώτη υποψήφια λέξη που αντιστοιχεί σε καταχώριση-μάρκα: ίδια λέξη (ή παραλλαγή της με ένα γράμμα λιγότερο) ΚΑΙ
 * περιγραφή «brand / company / manufacturer…». null: δεν βρέθηκε ή δεν υπάρχει σύνδεση.
 */
export async function lookupBrand(candidates: readonly string[]): Promise<BrandMatch | null> {
  let budget = MAX_REQUESTS;
  for (const candidate of candidates) {
    for (const q of brandQueries(candidate)) {
      if (budget-- <= 0) return null;
      let hits: SearchHit[];
      try { hits = await search(q); } catch { return null; }   // χωρίς σύνδεση: σταματά αμέσως
      const hit = hits.find((h) => h.label && sameWord(h.label, q) && describesBrand(h.description ?? ''));
      if (hit) return { brand: hit.label!, candidate, description: hit.description ?? '', id: hit.id };
    }
  }
  return null;
}
