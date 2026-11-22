/**
 * Έτοιμες αναζητήσεις για το ψηφιακό εγχειρίδιο ενός προϊόντος. Η εφαρμογή ΔΕΝ ψάχνει μόνη της στο διαδίκτυο:
 * φτιάχνει την ερώτηση και την ανοίγει στη μηχανή αναζήτησης που διάλεξε ο χρήστης.
 */
export type SearchEngine = 'duckduckgo' | 'google';
const ENGINE_URL: Record<SearchEngine, string> = {
  duckduckgo: 'https://duckduckgo.com/?q=',
  google: 'https://www.google.com/search?q=',
};

export interface ManualQuery { id: 'pdf' | 'support' | 'local'; query: string; url: string }

export function manualQueries(p: { brand: string; model: string; name: string }, engine: SearchEngine): ManualQuery[] {
  const brand = p.brand.trim(), model = p.model.trim();
  // ο κωδικός μοντέλου σε εισαγωγικά: ακριβές ταίριασμα· χωρίς μοντέλο, το όνομα του προϊόντος
  const subject = model ? `${brand} "${model}"`.trim() : [brand, p.name.trim()].filter(Boolean).join(' ');
  if (!subject) return [];
  const mk = (id: ManualQuery['id'], query: string): ManualQuery => ({ id, query, url: ENGINE_URL[engine] + encodeURIComponent(query) });
  return [
    mk('pdf', `${subject} user manual filetype:pdf`),
    mk('local', `${subject} εγχειρίδιο χρήσης οδηγίες`),
    mk('support', `${subject} support manual download`),
  ];
}
