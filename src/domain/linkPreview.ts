/**
 * Τίτλος και εικονίδιο ενός συνδέσμου (π.χ. από QR του εντύπου): «X7 Usage EN». Καθαρές συναρτήσεις· τα
 * αιτήματα: services/linkPreview.
 * - Βίντεο: oEmbed (ανοιχτό πρότυπο, χωρίς κλειδί· επαληθευμένα endpoints YouTube και Vimeo, 23/11/2026).
 * - Άλλες σελίδες: <title> / og:title και τα εικονίδια που δηλώνει η ίδια η σελίδα (όχι υπηρεσία τρίτου).
 */

/** endpoint oEmbed για γνωστές υπηρεσίες βίντεο, αλλιώς null */
export function oembedUrl(url: string): string | null {
  let host: string;
  try { host = new URL(url).hostname.toLowerCase(); } catch { return null; }
  const under = (h: string) => host === h || host.endsWith(`.${h}`);
  if (under('youtube.com') || under('youtu.be')) return `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`;
  if (under('vimeo.com')) return `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`;
  return null;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: '\'', nbsp: ' ', '#39': '\'' };
/** HTML entities → χαρακτήρες, κενά σε ένα, έως 200 χαρακτήρες */
export function cleanText(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z0-9#]+);/gi, (m, n: string) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ').trim().slice(0, 200);
}

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))?.slice(2).find((x) => x !== undefined);

/** Από το <head> μιας σελίδας: τίτλος και εικονίδια (απόλυτες διευθύνσεις, με σειρά προτίμησης). */
export function parseHead(html: string, pageUrl: string): { title: string | null; icons: string[] } {
  const head = html.slice(0, 300_000);
  const metas = [...head.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
  const og = metas.find((m) => /property\s*=\s*["']?og:title/i.test(m));
  const rawTitle = (og && attr(og, 'content')) ?? head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? null;
  const title = rawTitle ? cleanText(rawTitle) || null : null;
  const abs = (href: string) => { try { return new URL(href, pageUrl).href; } catch { return null; } };
  const links = [...head.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
  const rank = (rel: string) => (/apple-touch-icon/i.test(rel) ? 0 : /(^|\s)icon(\s|$)/i.test(rel) ? 1 : 9);
  const icons = links
    .map((l) => ({ rel: attr(l, 'rel') ?? '', href: attr(l, 'href') }))
    .filter((l) => l.href && rank(l.rel) < 9)
    .sort((a, b) => rank(a.rel) - rank(b.rel))
    .map((l) => abs(l.href!))
    .filter((u): u is string => !!u && /^https:/.test(u));
  const fallback = abs('/favicon.ico');
  return { title, icons: [...new Set([...icons, ...(fallback && /^https:/.test(fallback) ? [fallback] : [])])].slice(0, 4) };
}

/**
 * Τίτλος βίντεο χωρίς το όνομα της υπηρεσίας μπροστά (απόφαση 24/11/2026: το εικονίδιο δείχνει ήδη ότι είναι βίντεο,
 * και έτσι χωρά περισσότερος τίτλος). Η υπηρεσία μόνο όταν λείπει τίτλος.
 */
export function formatTitle(provider: string | null, title: string | null): string | null {
  const t = title ? cleanText(title) : '';
  return t || (provider ? cleanText(provider) || null : null);
}
