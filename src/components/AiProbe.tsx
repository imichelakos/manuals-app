/**
 * Ρυθμίσεις → Για δοκιμές → «Δοκιμή αναγνώρισης (AI)»: πρωτότυπο για μέτρηση στη συσκευή. Δείχνει τι διάβασε το OCR
 * της Apple (με μέγεθος γραμμής), τι κατάλαβε το μοντέλο της Apple και σε πόσο χρόνο. Δεν αποθηκεύει τίποτα.
 */
import { useEffect, useState } from 'react';
import { FilePick, IMAGE_TYPES } from './controls';
import { productReaderAvailable, productReaderStatus, readProduct, type ProductRead, type ProductReaderStatus } from '@/services/productReader';
import { t } from '@/i18n';

export function AiProbe() {
  const [status, setStatus] = useState<ProductReaderStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ProductRead | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { void productReaderStatus().then(setStatus); }, []);

  if (!productReaderAvailable) return <p className="py-2 text-[13px] text-ink-3">{t('Μόνο στην εφαρμογή για iPhone και iPad.')}</p>;
  const run = async (f: File) => {
    setBusy(true); setResult(null); setError('');
    try { setResult(await readProduct(f)); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-2 py-2 text-[13px]">
      <p className="font-semibold">{t('Δοκιμή αναγνώρισης (AI)')}</p>
      {status && <p className="break-all text-ink-2">iOS {status.ios} · {status.device} · SDK {status.sdk || '—'} · Xcode {status.xcode || '—'} · AI: {status.ai}</p>}
      <FilePick accept={IMAGE_TYPES} disabled={busy} onFiles={(f) => void run(f[0]!)} className="btn btn-plain w-full">{busy ? t('Ανάγνωση…') : t('Επίλεξε εικόνα εξωφύλλου')}</FilePick>
      {error && <p className="text-bad">{error}</p>}
      {result && (
        <div className="space-y-1.5 rounded-2xl bg-surface-2 p-3">
          <p><b>AI</b> ({result.aiMs} ms, {result.aiStatus}): {result.ai ? `${result.ai.brand || '—'} · ${result.ai.model || '—'} · ${result.ai.kind || '—'}` : (result.aiError ?? '—')}</p>
          <p><b>OCR</b> ({result.ocrMs} ms, {result.lines.length}):</p>
          <ol className="max-h-60 overflow-auto">
            {[...result.lines].sort((a, b) => b.size - a.size).slice(0, 15).map((l, i) => <li key={i} className="break-all">[{Math.round(l.size * 1000)}] {l.text}</li>)}
          </ol>
        </div>
      )}
    </div>
  );
}
