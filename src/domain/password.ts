/**
 * Ισχύς κωδικού για το κρυπτογραφημένο αντίγραφο ασφαλείας. Ο κωδικός είναι το ΜΟΝΟ που προστατεύει το αρχείο όταν
 * φύγει από τη συσκευή (email, cloud, USB), άρα οι κανόνες είναι αυστηροί:
 *  - τουλάχιστον 12 χαρακτήρες και 3 από τα 4 είδη (πεζά, κεφαλαία, ψηφία, σύμβολα), ή
 *  - φράση από 16+ χαρακτήρες (π.χ. τέσσερις λέξεις με κενά), που είναι ισχυρή και πιο εύκολη στη μνήμη·
 *  - όχι ένας χαρακτήρας επαναλαμβανόμενος, όχι σκέτη ακολουθία (1234…, abcd…, qwerty…).
 */
export type PasswordProblem = 'short' | 'variety' | 'repeated' | 'sequence';
export interface PasswordCheck { ok: boolean; problems: PasswordProblem[]; /** 0–4 για τη μπάρα ισχύος */ score: number }

export const PASSWORD_MIN = 12;
export const PASSPHRASE_MIN = 16;
const SEQUENCES = ['0123456789', 'abcdefghijklmnopqrstuvwxyz', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm', 'αβγδεζηθικλμνξοπρστυφχψω'];

function isSequence(pw: string): boolean {
  const s = pw.toLowerCase();
  if (s.length < 4) return false;
  if (SEQUENCES.some((q) => q.includes(s) || [...q].reverse().join('').includes(s)) || /^(.{1,4})\1+$/u.test(s)) return true;
  // σταθερό βήμα ±1 σε όλο το μήκος (1234567890123…, 9876…), με τα ψηφία να «γυρίζουν» 9→0
  const c = [...s].map((ch) => ch.codePointAt(0)!);
  const step = (a: number, b: number) => (/\d/.test(String.fromCodePoint(a)) && /\d/.test(String.fromCodePoint(b)) ? ((b - a + 10) % 10 === 1 ? 1 : (a - b + 10) % 10 === 1 ? -1 : 0) : b - a);
  const first = step(c[0]!, c[1]!);
  return Math.abs(first) === 1 && c.every((x, i) => i === 0 || step(c[i - 1]!, x) === first);
}

export function checkPassword(pw: string): PasswordCheck {
  const len = [...pw].length;
  const kinds = [/\p{Ll}/u, /\p{Lu}/u, /\p{N}/u, /[^\p{L}\p{N}]/u].filter((r) => r.test(pw)).length;
  const problems: PasswordProblem[] = [];
  const phrase = len >= PASSPHRASE_MIN;
  if (len < PASSWORD_MIN) problems.push('short');
  else if (!phrase && kinds < 3) problems.push('variety');
  if (len > 0 && new Set(pw).size <= 2) problems.push('repeated');
  else if (isSequence(pw)) problems.push('sequence');
  const ok = problems.length === 0;
  const score = !len ? 0 : !ok ? 1 : Math.min(4, 2 + +(len >= 16) + +(kinds >= 3 && len >= 14));
  return { ok, problems, score };
}
