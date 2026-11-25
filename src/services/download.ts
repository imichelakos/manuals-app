/**
 * Κατέβασμα ενός PDF από διεύθυνση που έδωσε ο χρήστης (επικόλληση ή QR). Δεκτό μόνο https και μόνο περιεχόμενο που
 * είναι πράγματι PDF· χωρίς cookies και χωρίς παραπομπή.
 * - iPhone/iPad: από τον κώδικα iOS (ios/App/App/PdfDownloadPlugin.swift) — χωρίς τον περιορισμό CORS, με πρόοδο,
 *   πραγματική ακύρωση και όριο 200 MB. Αν η διεύθυνση είναι ιστοσελίδα, επιστρέφονται τα PDF που βρέθηκαν σε αυτήν.
 * - Web: fetch του browser· πετυχαίνει μόνο όταν ο ιστότοπος το επιτρέπει (CORS)· αλλιώς ο χρήστης το κατεβάζει από τον
 *   browser και το εισάγει ως αρχείο.
 */
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { parseHttpUrl } from '@/domain/codes';
import { fileNameOf, pdfLinksFromHtml, type PdfLink } from '@/domain/pdfLinks';
import { MAX_FILE_BYTES, isPdf } from './files';

export type DownloadFailure = 'bad-url' | 'insecure' | 'blocked' | 'http' | 'network' | 'not-pdf' | 'too-big' | 'cancelled';
export type DownloadResult =
  | { ok: true; blob: Blob; name: string }
  /** links: τα PDF της σελίδας, όταν η διεύθυνση ήταν ιστοσελίδα (μόνο iOS) */
  | { ok: false; reason: DownloadFailure; links?: PdfLink[] };

/** bytes ως τώρα· total: null όταν ο ιστότοπος δεν δηλώνει μέγεθος */
export interface DownloadProgress { bytes: number; total: number | null }
export interface DownloadOptions { onProgress?: (p: DownloadProgress) => void; signal?: AbortSignal }

interface PdfDownloadPlugin {
  download(o: { url: string; id: string; maxBytes: number }): Promise<{ path: string; finalUrl: string; mime: string; size: number }>;
  cancel(o: { id: string }): Promise<void>;
  discard(o: { path: string }): Promise<void>;
  addListener(event: 'progress', fn: (e: { id: string; bytes: number; total: number }) => void): Promise<PluginListenerHandle>;
}
// τα plugins του Capacitor είναι Proxy που «απαντούν» και σε `then`: δηλώνονται στο επίπεδο του module, όχι μέσα σε Promise
const PdfDownload = registerPlugin<PdfDownloadPlugin>('PdfDownload');
const native = Capacitor.getPlatform() === 'ios' && Capacitor.isPluginAvailable('PdfDownload');
/** κατέβασμα και από ιστοσελίδα (βρίσκονται τα PDF της): μόνο μέσω iOS — στο web το εμποδίζει το CORS */
export const pageDownloadSupported = native;

/** μέγιστο μέγεθος ιστοσελίδας που διαβάζεται για να βρεθούν τα PDF της */
const MAX_PAGE_BYTES = 5 * 1024 ** 2;

export async function downloadPdf(raw: string, o: DownloadOptions = {}): Promise<DownloadResult> {
  const u = parseHttpUrl(raw);
  if (!u) return { ok: false, reason: 'bad-url' };
  if (u.protocol !== 'https:') return { ok: false, reason: 'insecure' };
  return native ? nativeDownload(u.href, o) : webDownload(u, o);
}

async function nativeDownload(url: string, o: DownloadOptions): Promise<DownloadResult> {
  if (o.signal?.aborted) return { ok: false, reason: 'cancelled' };
  const id = crypto.randomUUID();
  const sub = await PdfDownload.addListener('progress', (e) => {
    if (e.id === id) o.onProgress?.({ bytes: e.bytes, total: e.total > 0 ? e.total : null });
  });
  const onAbort = () => void PdfDownload.cancel({ id });
  o.signal?.addEventListener('abort', onAbort);
  let path: string | null = null;
  try {
    const r = await PdfDownload.download({ url, id, maxBytes: MAX_FILE_BYTES });
    path = r.path;
    // το αρχείο διαβάζεται τοπικά από τη σελίδα (χωρίς base64 μέσα από τη γέφυρα)
    const blob = await (await fetch(Capacitor.convertFileSrc(r.path))).blob();
    if (await isPdf(blob)) return { ok: true, blob: new Blob([blob], { type: 'application/pdf' }), name: fileNameOf(r.finalUrl || url) };
    const html = /html|xml|text/i.test(r.mime) && blob.size <= MAX_PAGE_BYTES ? await blob.text() : '';
    const links = html ? pdfLinksFromHtml(html, r.finalUrl || url) : [];
    return { ok: false, reason: 'not-pdf', links };
  } catch (e) {
    const code = (e as { code?: string }).code;
    return { ok: false, reason: code === 'too-big' || code === 'cancelled' || code === 'http' ? code : 'network' };
  } finally {
    o.signal?.removeEventListener('abort', onAbort);
    void sub.remove();
    if (path) void PdfDownload.discard({ path }).catch(() => {});
  }
}

async function webDownload(u: URL, o: DownloadOptions): Promise<DownloadResult> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 60_000);
  const onAbort = () => ctl.abort();
  o.signal?.addEventListener('abort', onAbort);
  try {
    const r = await fetch(u.href, { credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'follow', signal: ctl.signal });
    if (!r.ok) return { ok: false, reason: 'blocked' };
    if (Number(r.headers.get('content-length') ?? 0) > MAX_FILE_BYTES) return { ok: false, reason: 'too-big' };
    const blob = await r.blob();
    if (blob.size > MAX_FILE_BYTES) return { ok: false, reason: 'too-big' };
    if (!(await isPdf(blob))) return { ok: false, reason: 'not-pdf' };
    return { ok: true, blob, name: fileNameOf(u.href) };
  } catch {
    // δίκτυο, CORS ή λήξη χρόνου — ή ακύρωση από τον χρήστη
    return { ok: false, reason: o.signal?.aborted ? 'cancelled' : 'blocked' };
  } finally {
    clearTimeout(timer);
    o.signal?.removeEventListener('abort', onAbort);
  }
}
