/**
 * Τα PDF μιας ιστοσελίδας (συνήθως η σελίδα υποστήριξης του κατασκευαστή, όταν ο χρήστης επικολλήσει αυτήν αντί για το
 * ίδιο το PDF): οι σύνδεσμοι <a> που οδηγούν σε αρχείο .pdf, με το κείμενό τους ως τίτλο. Καθαρή συνάρτηση· το
 * κατέβασμα της σελίδας: services/download. Μόνο https· έως 30, χωρίς διπλότυπα, με τη σειρά της σελίδας.
 */
import { attr, cleanText } from './linkPreview';

export interface PdfLink { url: string; title: string }

const MAX_LINKS = 30;
/** το αρχείο στη διαδρομή (όχι στο query) τελειώνει σε .pdf */
const isPdfPath = (u: URL) => /\.pdf$/i.test(u.pathname);

export function pdfLinksFromHtml(html: string, pageUrl: string): PdfLink[] {
  const page = html.slice(0, 5_000_000);
  const baseHref = page.match(/<base\b[^>]*>/i)?.[0];
  let base = pageUrl;
  try { if (baseHref && attr(baseHref, 'href')) base = new URL(attr(baseHref, 'href')!, pageUrl).href; } catch { /* η σελίδα ως βάση */ }
  const out: PdfLink[] = [];
  const seen = new Set<string>();
  for (const m of page.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attr(`<a ${m[1]}>`, 'href');
    if (!href) continue;
    let u: URL;
    try { u = new URL(cleanText(href), base); } catch { continue; }
    if (u.protocol !== 'https:' || !isPdfPath(u)) continue;
    u.hash = '';
    if (seen.has(u.href)) continue;
    seen.add(u.href);
    const text = cleanText(m[2]!.replace(/<[^>]*>/g, ' '));
    const label = attr(`<a ${m[1]}>`, 'title') ?? attr(`<a ${m[1]}>`, 'aria-label');
    out.push({ url: u.href, title: text || (label ? cleanText(label) : '') || fileNameOf(u.href) });
    if (out.length >= MAX_LINKS) break;
  }
  return out;
}

/** όνομα αρχείου από τη διεύθυνση: το τελευταίο κομμάτι της διαδρομής, αλλιώς ο ιστότοπος */
export function fileNameOf(url: string): string {
  try {
    const u = new URL(url);
    let last = u.pathname.split('/').filter(Boolean).pop() ?? '';
    try { last = decodeURIComponent(last); } catch { /* ως έχει */ }
    return last.slice(0, 120) || u.hostname;
  } catch { return 'manual'; }
}
