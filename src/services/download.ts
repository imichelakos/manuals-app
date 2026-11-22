/**
 * Κατέβασμα ενός PDF από διεύθυνση που έδωσε ο χρήστης (επικόλληση ή QR). Η ΜΟΝΗ κλήση δικτύου της εφαρμογής.
 * Σε browser πετυχαίνει μόνο όταν ο ιστότοπος το επιτρέπει (CORS)· αλλιώς ο χρήστης το κατεβάζει από τον browser και
 * το εισάγει ως αρχείο. Χωρίς cookies/παραπομπή· δεκτό μόνο https και μόνο περιεχόμενο που είναι πράγματι PDF.
 */
import { parseHttpUrl } from '@/domain/codes';
import { MAX_FILE_BYTES, isPdf } from './files';

export type DownloadFailure = 'bad-url' | 'insecure' | 'blocked' | 'not-pdf' | 'too-big';
export type DownloadResult = { ok: true; blob: Blob; name: string } | { ok: false; reason: DownloadFailure };

export async function downloadPdf(raw: string): Promise<DownloadResult> {
  const u = parseHttpUrl(raw);
  if (!u) return { ok: false, reason: 'bad-url' };
  if (u.protocol !== 'https:') return { ok: false, reason: 'insecure' };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 60_000);
  try {
    const r = await fetch(u.href, { credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'follow', signal: ctl.signal });
    if (!r.ok) return { ok: false, reason: 'blocked' };
    if (Number(r.headers.get('content-length') ?? 0) > MAX_FILE_BYTES) return { ok: false, reason: 'too-big' };
    const blob = await r.blob();
    if (blob.size > MAX_FILE_BYTES) return { ok: false, reason: 'too-big' };
    if (!(await isPdf(blob))) return { ok: false, reason: 'not-pdf' };
    const last = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() ?? '').slice(0, 120);
    return { ok: true, blob, name: last || u.hostname };
  } catch {
    return { ok: false, reason: 'blocked' }; // δίκτυο, CORS ή λήξη χρόνου
  } finally {
    clearTimeout(timer);
  }
}
