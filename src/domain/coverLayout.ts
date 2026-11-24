/**
 * Η διάταξη του εξωφύλλου, χωρίς λίστα μαρκών: από τις γραμμές του OCR με το ύψος τους (OCR της Apple στο iOS), οι
 * μεγάλες γραμμές είναι συνήθως η μάρκα και το όνομα του προϊόντος. Δίνει:
 * - brandCandidates: μονολεκτικές μεγάλες γραμμές (π.χ. «OBLIGHT») για επιβεβαίωση στο web (domain/brandLookup)·
 * - modelHints: σύντομες μεγάλες γραμμές (π.χ. «Baton Turbo») ως προτάσεις μοντέλου (απόφαση 23/11/2026: μόνο chips).
 */
export interface CoverLine { text: string; size: number }
export interface CoverLayout { brandCandidates: string[]; modelHints: string[] }

/** γενικές λέξεις εξωφύλλου (κεφαλαία, χωρίς τόνους) — ποτέ μάρκα ή μοντέλο */
const GENERIC = new Set([
  'USER', 'USERS', 'MANUAL', 'OWNER', 'OWNERS', 'OWNER’S', "OWNER'S", 'GUIDE', 'INSTRUCTION', 'INSTRUCTIONS', 'QUICK', 'START',
  'HANDBOOK', 'OPERATING', 'OPERATION', 'INSTALLATION', 'SAFETY', 'WARRANTY', 'MODEL', 'SERIES', 'THE', 'AND', 'FOR', 'WITH',
  'ΟΔΗΓΙΕΣ', 'ΧΡΗΣΗΣ', 'ΕΓΧΕΙΡΙΔΙΟ', 'ΕΓΚΑΤΑΣΤΑΣΗΣ', 'ΜΟΝΤΕΛΟ',
  'MODE', 'EMPLOI', 'NOTICE', 'MANUALE', 'ISTRUZIONI', 'BEDIENUNGSANLEITUNG', 'ANLEITUNG', 'GEBRAUCHSANLEITUNG', 'MANUEL',
]);
const plain = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase();
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
const isGeneric = (s: string) => words(s).every((w) => GENERIC.has(plain(w).replace(/[^\p{L}’']/gu, '')));
/** πρόταση/περιγραφή, όχι τίτλος: πολλές λέξεις ή σημεία στίξης */
const isSentence = (s: string) => words(s).length > 4 || /[,.;:!?]\s|[,;:!?]$/.test(s);

/**
 * Καθαρισμός γραμμής OCR: πλαίσια γύρω από λέξεις διαβάζονται συχνά ως παρένθεση ή αγκύλη («Baton (Turbo» για το
 * «Turbo» μέσα σε πλαίσιο). Φεύγουν οι αγκύλες/παρενθέσεις που δεν κλείνουν και τα «|»· οι σωστές («(2024)») μένουν.
 */
export function cleanLine(raw: string): string {
  const chars = [...raw.replace(/[|¦]/g, ' ')];
  const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
  const open: number[] = [];
  const drop = new Set<number>();
  chars.forEach((c, i) => {
    if ('([{'.includes(c)) open.push(i);
    else if (c in pairs) {
      const j = open.length ? open[open.length - 1]! : -1;
      if (j >= 0 && chars[j] === pairs[c]) open.pop(); else drop.add(i);
    }
  });
  open.forEach((i) => drop.add(i));
  return chars.filter((_, i) => !drop.has(i)).join('').replace(/\s+/g, ' ').trim().replace(/[.,:;]+$/, '');
}

/** πόσες από τις μεγαλύτερες γραμμές εξετάζονται */
const TOP = 8;

export function coverLayout(lines: readonly CoverLine[]): CoverLayout {
  const top = [...lines]
    .map((l) => ({ text: cleanLine(l.text), size: l.size }))
    .filter((l) => l.text && /\p{L}/u.test(l.text) && !isSentence(l.text) && !isGeneric(l.text))
    .sort((a, b) => b.size - a.size)
    .slice(0, TOP);
  const brandCandidates: string[] = [];
  const modelHints: string[] = [];
  for (const l of top) {
    const ws = words(l.text);
    // μάρκα: μία λέξη, τουλάχιστον 3 γράμματα, κυρίως γράμματα (όχι κωδικός όπως «WAU28PH9BY»)
    if (ws.length === 1 && (l.text.match(/\p{L}/gu)?.length ?? 0) >= 3 && !/\d/.test(l.text) && !brandCandidates.includes(l.text)) brandCandidates.push(l.text);
    if (ws.length <= 4 && !modelHints.includes(l.text)) modelHints.push(l.text);
  }
  return { brandCandidates: brandCandidates.slice(0, 4), modelHints: modelHints.slice(0, 4) };
}
