/**
 * Επιβεβαίωση μάρκας από ανοιχτή βάση στο web (Wikidata), χωρίς λίστα μαρκών: οι λέξεις που ψάχνονται και ο κανόνας
 * αποδοχής. Τα αιτήματα: services/wikidata. Το OCR χάνει ή προσθέτει συχνά ένα γράμμα σε λογότυπα («OBLIGHT» αντί για
 * «OLIGHT»), οπότε ψάχνονται και οι παραλλαγές με ένα γράμμα λιγότερο.
 */

/** η λέξη και οι παραλλαγές της με ένα γράμμα λιγότερο (για λέξεις 5+ γραμμάτων), χωρίς διπλότυπα */
export function brandQueries(candidate: string): string[] {
  const w = candidate.trim();
  const out = [w];
  if ([...w].length >= 5) for (let i = 0; i < w.length; i++) out.push(w.slice(0, i) + w.slice(i + 1));
  return [...new Set(out.map((x) => x.toLowerCase()))];
}

/** η περιγραφή της καταχώρισης λέει ότι είναι μάρκα / εταιρεία / κατασκευαστής (αγγλικά, όπως τις ζητάμε) */
export const describesBrand = (description: string): boolean =>
  /\b(brand|company|manufacturer|corporation|maker|marque|firm|enterprise|conglomerate|multinational)\b/i.test(description);

/** ίδια λέξη χωρίς κεφαλαία/τόνους: η καταχώριση ταιριάζει με αυτό που ψάξαμε, όχι κάτι που απλώς αρχίζει έτσι */
export const sameWord = (a: string, b: string): boolean =>
  a.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase() === b.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
