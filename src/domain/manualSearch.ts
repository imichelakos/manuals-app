/**
 * Έτοιμες αναζητήσεις για το ψηφιακό εγχειρίδιο ενός προϊόντος. Η εφαρμογή ΔΕΝ ψάχνει μόνη της στο διαδίκτυο:
 * φτιάχνει την ερώτηση και την ανοίγει στη μηχανή αναζήτησης που διάλεξε ο χρήστης.
 *
 * Σειρά: πρώτα στα αγγλικά (η κύρια γλώσσα των εγχειριδίων — εκεί βρίσκεται συνήθως το PDF του κατασκευαστή), μετά στη
 * γλώσσα του χρήστη, αν δεν είναι τα αγγλικά και ξέρουμε πώς λέγεται «εγχειρίδιο χρήσης» σε αυτήν.
 */
export const SEARCH_ENGINES = ['duckduckgo', 'qwant', 'startpage', 'brave', 'mojeek', 'ecosia', 'google'] as const;
export type SearchEngine = (typeof SEARCH_ENGINES)[number];

/** Όνομα για την οθόνη και διεύθυνση αναζήτησης (η ερώτηση μπαίνει στο τέλος, κωδικοποιημένη). */
export const ENGINES: Record<SearchEngine, { name: string; url: string }> = {
  duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
  qwant: { name: 'Qwant', url: 'https://www.qwant.com/?q=' },
  startpage: { name: 'Startpage', url: 'https://www.startpage.com/do/search?q=' },
  brave: { name: 'Brave Search', url: 'https://search.brave.com/search?q=' },
  mojeek: { name: 'Mojeek', url: 'https://www.mojeek.com/search?q=' },
  ecosia: { name: 'Ecosia', url: 'https://www.ecosia.org/search?q=' },
  google: { name: 'Google', url: 'https://www.google.com/search?q=' },
};
export const isSearchEngine = (v: unknown): v is SearchEngine => (SEARCH_ENGINES as readonly unknown[]).includes(v);

/** «Εγχειρίδιο χρήσης» σε όσες γλώσσες το ξέρουμε (κωδικός ISO 639-1). */
const MANUAL_TERMS: Record<string, string> = {
  el: 'εγχειρίδιο χρήσης οδηγίες',
  de: 'Bedienungsanleitung',
  fr: "mode d'emploi notice",
  it: "manuale d'uso istruzioni",
  es: 'manual de instrucciones',
  pt: 'manual de instruções',
  nl: 'handleiding',
  pl: 'instrukcja obsługi',
  cs: 'návod k obsluze',
  sv: 'bruksanvisning',
  nb: 'bruksanvisning',
  no: 'bruksanvisning',
  da: 'brugsanvisning',
  fi: 'käyttöohje',
  tr: 'kullanım kılavuzu',
  ro: 'manual de utilizare',
  hu: 'használati útmutató',
};

/** Η πρώτη από τις γλώσσες του χρήστη (π.χ. navigator.languages) για την οποία έχουμε όρο· τα αγγλικά δεν μετράνε. */
export function localManualLanguage(languages: readonly string[]): string | null {
  for (const l of languages) {
    const code = l.toLowerCase().split(/[-_]/)[0]!;
    if (code !== 'en' && code in MANUAL_TERMS) return code;
  }
  return null;
}

export interface ManualQuery { id: 'pdf' | 'support' | 'local'; query: string; url: string; lang: string }

export function manualQueries(p: { brand: string; model: string; name: string }, engine: SearchEngine, localLang: string | null): ManualQuery[] {
  const brand = p.brand.trim(), model = p.model.trim();
  // ο κωδικός μοντέλου σε εισαγωγικά: ακριβές ταίριασμα· χωρίς μοντέλο, το όνομα του προϊόντος
  const subject = model ? `${brand} "${model}"`.trim() : [brand, p.name.trim()].filter(Boolean).join(' ');
  if (!subject) return [];
  const mk = (id: ManualQuery['id'], query: string, lang: string): ManualQuery => ({ id, query, lang, url: ENGINES[engine].url + encodeURIComponent(query) });
  const term = localLang ? MANUAL_TERMS[localLang] : undefined;
  return [
    mk('pdf', `${subject} user manual filetype:pdf`, 'en'),
    mk('support', `${subject} support manual download`, 'en'),
    ...(term ? [mk('local', `${subject} ${term}`, localLang!)] : []),
  ];
}
