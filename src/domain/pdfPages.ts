/**
 * Πλήθος σελίδων ενός PDF χωρίς βιβλιοθήκη ανάγνωσης PDF: το «/Count» του ριζικού κόμβου σελίδων (/Type /Pages).
 * Στα νεότερα PDF (1.5+) τα λεξικά είναι συχνά συμπιεσμένα μέσα σε «object streams» (/Type /ObjStm, FlateDecode):
 * τότε αποσυμπιέζονται ΜΟΝΟ αυτά (όχι εικόνες ή περιεχόμενο σελίδων). Τελευταία λύση: μέτρηση των /Type /Page.
 * Καθαρή συνάρτηση· η αποσυμπίεση zlib δίνεται από τον καλούντα (fflate), ώστε να δοκιμάζεται χωρίς browser.
 * null: δεν βρέθηκε αξιόπιστος αριθμός.
 */
export type Inflate = (bytes: Uint8Array) => Uint8Array;

const MAX_INFLATED = 64 * 1024 ** 2; // όριο αποσυμπίεσης: προστασία από «βόμβες» συμπίεσης

const latin1 = (b: Uint8Array) => new TextDecoder('latin1').decode(b);

/** Το λεξικό « … » που περιέχει τη θέση idx (με σωστό βάθος για εμφωλευμένα λεξικά). */
function dictAround(s: string, idx: number): { text: string; end: number } | null {
  let depth = 0, start = -1;
  for (let i = idx; i > 0; i--) {
    if (s[i] === '>' && s[i - 1] === '>') { depth++; i--; } else if (s[i] === '<' && s[i - 1] === '<') { if (depth === 0) { start = i - 1; break; } depth--; i--; }
  }
  if (start < 0) return null;
  depth = 0;
  for (let i = start; i < s.length - 1; i++) {
    if (s[i] === '<' && s[i + 1] === '<') { depth++; i++; } else if (s[i] === '>' && s[i + 1] === '>') { depth--; i++; if (depth === 0) return { text: s.slice(start, i + 1), end: i + 1 }; }
  }
  return null;
}

/** Το μεγαλύτερο /Count σε λεξικό /Type /Pages (η ρίζα έχει το σύνολο). */
function maxPagesCount(s: string): number {
  let best = 0;
  for (const m of s.matchAll(/\/Type\s*\/Pages\b/g)) {
    const d = dictAround(s, m.index);
    const c = d && /\/Count\s+(\d+)/.exec(d.text);
    if (c) best = Math.max(best, Number(c[1]));
  }
  return best;
}

export function countPdfPages(bytes: Uint8Array, inflate: Inflate): number | null {
  const s = latin1(bytes);
  const direct = maxPagesCount(s);
  if (direct) return direct;

  let total = 0, best = 0;
  for (const m of s.matchAll(/\/Type\s*\/ObjStm\b/g)) {
    const d = dictAround(s, m.index);
    if (!d || !/\/FlateDecode/.test(d.text)) continue;
    const at = d.end;
    const kw = /^\s*stream\r?\n/.exec(s.slice(at, at + 20));
    if (!kw) continue;
    const from = at + kw[0].length;
    const to = s.indexOf('endstream', from);
    if (to < 0) continue;
    try {
      const out = inflate(bytes.subarray(from, to));
      total += out.length;
      if (total > MAX_INFLATED) break;
      best = Math.max(best, maxPagesCount(latin1(out)));
    } catch { /* κατεστραμμένο ή άλλη συμπίεση: επόμενο */ }
  }
  if (best) return best;

  const pages = s.match(/\/Type\s*\/Page\b(?!s)/g)?.length ?? 0;
  return pages || null;
}
