/**
 * Τι σημαίνει ένας κωδικός που διαβάστηκε από το έντυπο (QR ή barcode): σύνδεσμος (βίντεο, PDF, εφαρμογή, σελίδα),
 * barcode προϊόντος, ή απλό κείμενο. Το περιεχόμενο ενός QR είναι ΑΓΝΩΣΤΗΣ προέλευσης: δεν ανοίγει ποτέ αυτόματα,
 * δεχόμαστε μόνο http/https, και η οθόνη δείχνει πάντα τον προορισμό πριν από οποιοδήποτε άνοιγμα.
 */
import type { LinkKind } from './model';

export type CodePayload =
  | { type: 'link'; url: string; host: string; kind: LinkKind; insecure: boolean; manualHint: boolean }
  | { type: 'ean'; code: string }
  | { type: 'text'; text: string };

const VIDEO_HOSTS = ['youtube.com', 'youtu.be', 'vimeo.com'];
const APP_HOSTS = ['apps.apple.com', 'itunes.apple.com', 'play.google.com'];
const MANUAL_WORDS = /manual|support|download|guide|instruction|anleitung|handbuch|notice|egxeirid|odigies|doc/i;

const under = (host: string, list: string[]) => list.some((h) => host === h || host.endsWith(`.${h}`));

/** Έγκυρη διεύθυνση http(s) ή null. Δέχεται και «www.…» χωρίς πρωτόκολλο. */
export function parseHttpUrl(raw: string): URL | null {
  const s = raw.trim();
  if (!s || /\s/.test(s)) return null;
  try {
    const u = new URL(/^www\./i.test(s) ? `https://${s}` : s);
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.includes('.') ? u : null;
  } catch { return null; }
}

export function linkKind(u: URL): LinkKind {
  const host = u.hostname.toLowerCase();
  if (under(host, VIDEO_HOSTS)) return 'video';
  if (under(host, APP_HOSTS)) return 'app';
  if (/\.pdf$/i.test(u.pathname)) return 'pdf';
  return 'web';
}

/** Ψηφίο ελέγχου EAN-13 / EAN-8 / UPC-A (GS1: βάρη 3-1 από δεξιά). */
export function eanOk(code: string): boolean {
  if (!/^(\d{8}|\d{12}|\d{13})$/.test(code)) return false;
  const d = [...code].map(Number);
  const check = d.pop()!;
  const sum = d.reverse().reduce((a, x, i) => a + x * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

export function classifyCode(raw: string): CodePayload {
  const u = parseHttpUrl(raw);
  if (u) {
    const kind = linkKind(u);
    return { type: 'link', url: u.href, host: u.hostname.toLowerCase(), kind, insecure: u.protocol === 'http:', manualHint: kind === 'pdf' || MANUAL_WORDS.test(u.pathname + u.hostname) };
  }
  const digits = raw.trim();
  if (eanOk(digits)) return { type: 'ean', code: digits };
  return { type: 'text', text: raw.trim().slice(0, 500) };
}
