/**
 * Τίτλος και εικονίδιο συνδέσμου από το διαδίκτυο, μέσω του iOS (CapacitorHttp: χωρίς τον περιορισμό CORS του WebView).
 * Στο web δεν γίνεται (null). Επικοινωνεί μόνο με τον ιστότοπο του συνδέσμου (και το oEmbed του YouTube/Vimeo για
 * βίντεο)· κανένα στοιχείο του χρήστη. Όρια χρόνου ώστε να μην κρατά ποτέ τη ροή.
 */
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { formatTitle, oembedUrl, parseHead } from '@/domain/linkPreview';
import { parseHttpUrl } from '@/domain/codes';

const available = Capacitor.getPlatform() === 'ios';
const TIMEOUT = { connectTimeout: 5000, readTimeout: 8000 };
const ICON_SIZE = 128;

/** finalUrl: ο τελικός σύνδεσμος μετά τις ανακατευθύνσεις (π.χ. bit.ly → YouTube)· ίδιος αν δεν υπήρξαν */
export interface LinkPreview { finalUrl: string; title: string | null; icon: string | null }

async function getText(url: string): Promise<string | null> {
  const r = await CapacitorHttp.get({ url, responseType: 'text', ...TIMEOUT });
  return r.status >= 200 && r.status < 300 ? (typeof r.data === 'string' ? r.data : JSON.stringify(r.data)) : null;
}

async function getJson(url: string): Promise<Record<string, unknown> | null> {
  const r = await CapacitorHttp.get({ url, responseType: 'json', ...TIMEOUT });
  if (r.status < 200 || r.status >= 300) return null;
  return typeof r.data === 'string' ? JSON.parse(r.data) as Record<string, unknown> : r.data as Record<string, unknown>;
}

/** εικόνα από το web → μικρή εικόνα data: (PNG, ≤128 px)· null αν δεν είναι εικόνα ή δεν αποκωδικοποιείται */
async function iconData(url: string): Promise<string | null> {
  const r = await CapacitorHttp.get({ url, responseType: 'blob', ...TIMEOUT });
  if (r.status < 200 || r.status >= 300 || typeof r.data !== 'string') return null;
  const type = String(Object.entries(r.headers ?? {}).find(([k]) => k.toLowerCase() === 'content-type')?.[1] ?? '').split(';')[0]!.trim();
  if (!/^image\//.test(type) && !/\.(ico|png|jpe?g|gif|webp|svg)(\?|$)/i.test(url)) return null;
  const bytes = Uint8Array.from(atob(r.data), (c) => c.charCodeAt(0));
  const src = URL.createObjectURL(new Blob([bytes], { type: type || 'image/png' }));
  try {
    const img = new Image();
    img.src = src;
    await img.decode();
    if (!img.naturalWidth) return null;
    const k = Math.min(1, ICON_SIZE / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k));
    c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    const data = c.toDataURL(c.width > 64 ? 'image/jpeg' : 'image/png', 0.8);
    return data.length <= 24_000 ? data : null;
  } catch { return null; } finally { URL.revokeObjectURL(src); }
}

/**
 * Τελικός σύνδεσμος (ακολουθώντας ανακατευθύνσεις HTTP: bit.ly, tinyurl…) και ο τύπος του περιεχομένου του. Πρώτα HEAD
 * (χωρίς να κατέβει το περιεχόμενο — π.χ. ένα PDF)· αν ο διακομιστής δεν το δέχεται, GET. null: αποτυχία.
 * Ανακατευθύνσεις μέσα από τη σελίδα (JavaScript, meta refresh) δεν ακολουθούνται.
 */
async function resolve(url: string): Promise<{ finalUrl: string; type: string } | null> {
  const typeOf = (h: Record<string, string> | undefined) => String(Object.entries(h ?? {}).find(([k]) => k.toLowerCase() === 'content-type')?.[1] ?? '').split(';')[0]!.trim().toLowerCase();
  for (const method of ['HEAD', 'GET']) {
    try {
      const r = await CapacitorHttp.request({ url, method, responseType: 'text', ...TIMEOUT });
      if (r.status >= 200 && r.status < 400) {
        const finalUrl = parseHttpUrl(r.url || url)?.href ?? url;
        return { finalUrl, type: typeOf(r.headers) };
      }
    } catch { /* επόμενη μέθοδος */ }
  }
  return null;
}

/** null: όχι στο iOS ή κανένα αποτέλεσμα. Ό,τι αποτύχει (τίτλος ή εικονίδιο) απλώς λείπει. */
export async function fetchLinkPreview(url: string): Promise<LinkPreview | null> {
  if (!available) return null;
  try {
    // γνωστό βίντεο: κατευθείαν oEmbed· αλλιώς πρώτα ο τελικός σύνδεσμος (ένα bit.ly μπορεί να οδηγεί σε YouTube)
    const direct = oembedUrl(url);
    const resolved = direct ? { finalUrl: url, type: '' } : await resolve(url);
    if (!resolved) return null;
    const { finalUrl, type } = resolved;
    const oembed = direct ?? oembedUrl(finalUrl);
    if (oembed) {
      const j = await getJson(oembed);
      if (!j) return { finalUrl, title: null, icon: null };
      const title = formatTitle(typeof j.provider_name === 'string' ? j.provider_name : null, typeof j.title === 'string' ? j.title : null);
      const icon = typeof j.thumbnail_url === 'string' && /^https:/.test(j.thumbnail_url) ? await iconData(j.thumbnail_url).catch(() => null) : null;
      return { finalUrl, title, icon };
    }
    // μόνο σελίδες HTML έχουν τίτλο· ένα PDF ή μια εικόνα δεν κατεβαίνει εδώ
    if (type && !/html/.test(type)) return { finalUrl, title: null, icon: null };
    if (/\.pdf(\?|$)/i.test(new URL(finalUrl).pathname)) return { finalUrl, title: null, icon: null };
    const html = await getText(finalUrl);
    if (!html) return { finalUrl, title: null, icon: null };
    const head = parseHead(html, finalUrl);
    let icon: string | null = null;
    for (const u of head.icons) { icon = await iconData(u).catch(() => null); if (icon) break; }
    return { finalUrl, title: head.title, icon };
  } catch { return null; }
}
