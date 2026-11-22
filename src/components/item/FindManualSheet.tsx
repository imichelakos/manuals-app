/**
 * «Βρες το ψηφιακό εγχειρίδιο»: τέσσερις δρόμοι, από τον πιο εύκολο —
 *  1. σύνδεσμος από το QR του εντύπου, 2. έτοιμη αναζήτηση στο διαδίκτυο, 3. επικόλληση διεύθυνσης PDF (κατέβασμα),
 *  4. εισαγωγή αρχείου ή φωτογράφιση των σελίδων. Όταν αποθηκευτεί, προτείνεται η ανακύκλωση του εντύπου.
 */
import { useState } from 'react';
import { displayName, type Item } from '@/domain/model';
import { classifyCode } from '@/domain/codes';
import { manualQueries } from '@/domain/manualSearch';
import { updateItem } from '@/data/library';
import { useSettings } from '@/data/settings';
import { downloadPdf, type DownloadFailure } from '@/services/download';
import { storeFile } from '@/services/files';
import { openExternal } from '@/services/platform';
import { t } from '@/i18n';
import { Sheet } from '@/components/Sheet';
import { DOC_TYPES, FilePick, IMAGE_TYPES } from '@/components/controls';
import { toast } from '@/components/Toast';
import { addFiles } from './Documents';
import { IconCamera, IconCheck, IconDownload, IconExternal, IconQr, IconRecycle, IconSearch, IconUpload } from '@/components/icons';

const failText = (r: DownloadFailure): string =>
  r === 'bad-url' ? t('Αυτή δεν μοιάζει με διεύθυνση ιστοσελίδας.')
    : r === 'insecure' ? t('Κατεβάζω μόνο από ασφαλείς διευθύνσεις (https).')
    : r === 'not-pdf' ? t('Η διεύθυνση δεν δίνει αρχείο PDF — ίσως είναι η σελίδα που το περιέχει.')
    : r === 'too-big' ? t('Το αρχείο είναι πολύ μεγάλο (όριο 200 MB).')
    : t('Ο ιστότοπος δεν επιτρέπει απευθείας κατέβασμα από την εφαρμογή.');

export function FindManualSheet({ item, onClose }: { item: Item; onClose: () => void }) {
  const { engine } = useSettings();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const queries = manualQueries(item, engine);
  const labels = { pdf: t('PDF του εγχειριδίου'), local: t('Εγχειρίδιο στα ελληνικά'), support: t('Σελίδα υποστήριξης') };
  // σύνδεσμοι από QR που μοιάζουν να οδηγούν στο εγχειρίδιο
  const fromQr = item.links.filter((l) => { const c = classifyCode(l.url); return c.type === 'link' && c.manualHint; });

  const fetchPdf = async (target: string) => {
    setBusy(true);
    setBlocked(null);
    const r = await downloadPdf(target);
    if (r.ok) {
      try {
        const a = await storeFile(r.blob, { kind: 'manual', origin: 'download', name: r.name, sourceUrl: target });
        await updateItem(item.id, (c) => ({ ...c, attachments: [...c.attachments, a] }));
        setSaved(true);
      } catch { toast(t('Το αρχείο δεν αποθηκεύτηκε. Ίσως δεν υπάρχει ελεύθερος χώρος.'), 'error'); }
    } else {
      toast(failText(r.reason), 'error');
      if (r.reason === 'blocked' || r.reason === 'not-pdf') setBlocked(target);
    }
    setBusy(false);
  };
  const addLocal = async (files: File[], origin: 'scan' | 'import') => {
    setBusy(true);
    const added = await addFiles(item.id, files, 'manual', origin);
    setBusy(false);
    if (added.length) setSaved(true);
  };

  if (saved) {
    return (
      <Sheet title={t('Το ψηφιακό αποθηκεύτηκε')} onClose={onClose}>
        <div className="flex flex-col items-center py-4 text-center">
          <span className="animate-pop flex size-24 items-center justify-center rounded-full bg-ok-soft text-5xl text-ok"><IconCheck /></span>
          <p className="mt-5 text-lg font-extrabold">{t('Δεν χρειάζεσαι πια το χαρτί')}</p>
          <p className="mt-1.5 max-w-xs text-[15px] leading-relaxed text-ink-2">{t('Το εγχειρίδιο είναι αποθηκευμένο στη συσκευή σου. Άνοιξέ το μία φορά για να βεβαιωθείς, και μετά ανακύκλωσε το έντυπο.')}</p>
          <button type="button" className="btn btn-primary mt-6 w-full" onClick={() => { void updateItem(item.id, (c) => ({ ...c, paper: 'recycled' })); toast(t('Σημειώθηκε ως ανακυκλωμένο')); onClose(); }}>
            <IconRecycle className="text-xl" />{t('Το ανακύκλωσα')}
          </button>
          <button type="button" className="btn btn-ghost mt-1 w-full" onClick={onClose}>{t('Όχι ακόμη')}</button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={t('Βρες το ψηφιακό')} onClose={onClose}>
      <p className="text-[15px] text-ink-2">{displayName(item) || t('Συμπλήρωσε μάρκα και μοντέλο για καλύτερη αναζήτηση.')}{item.name && item.model ? <> · <span className="mono text-[13px]">{item.model}</span></> : null}</p>

      {fromQr.length > 0 && (
        <Step n={1} title={t('Από το QR του εντύπου')} icon={<IconQr />}>
          {fromQr.map((l) => (
            <div key={l.id}>
              <p className="mono truncate text-[13px] text-ink-2">{l.url.replace(/^https?:\/\//, '')}</p>
              <div className="mt-2 flex gap-2">
                {l.kind === 'pdf' && <button type="button" className="btn btn-soft flex-1" disabled={busy} onClick={() => void fetchPdf(l.url)}><IconDownload className="text-lg" />{t('Κατέβασμα')}</button>}
                <button type="button" className="btn btn-plain flex-1" onClick={() => void openExternal(l.url)}><IconExternal className="text-lg" />{t('Άνοιγμα')}</button>
              </div>
            </div>
          ))}
        </Step>
      )}

      <Step n={fromQr.length ? 2 : 1} title={t('Αναζήτηση στο διαδίκτυο')} icon={<IconSearch />}>
        {queries.length === 0
          ? <p className="text-sm text-ink-2">{t('Συμπλήρωσε πρώτα μάρκα, μοντέλο ή όνομα στην καρτέλα του προϊόντος.')}</p>
          : <>
            <div className="flex flex-col gap-2">
              {queries.map((q) => (
                <button key={q.id} type="button" className="btn btn-soft justify-between text-left" onClick={() => void openExternal(q.url)}>
                  <span>{labels[q.id]}</span><IconExternal className="shrink-0 text-lg" />
                </button>
              ))}
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-3">{t('Ανοίγει στο {engine}. Προτίμησε τη σελίδα του κατασκευαστή. Αντίγραψε τη διεύθυνση του PDF και γύρνα εδώ.', { engine: engine === 'google' ? 'Google' : 'DuckDuckGo' })}</p>
          </>}
      </Step>

      <Step n={fromQr.length ? 3 : 2} title={t('Έχεις τη διεύθυνση του PDF;')} icon={<IconDownload />}>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (url.trim()) void fetchPdf(url.trim()); }}>
          <input className="input" type="url" inputMode="url" placeholder="https://…/manual.pdf" value={url} onChange={(e) => setUrl(e.target.value)} aria-label={t('Διεύθυνση του PDF')} autoComplete="off" />
          <button type="submit" className="btn btn-primary shrink-0" disabled={busy || !url.trim()}>{busy ? t('Κατεβάζω…') : t('Κατέβασμα')}</button>
        </form>
        {blocked && (
          <div className="mt-2.5 rounded-2xl bg-warn-soft p-3.5 text-[14px] leading-relaxed text-warn">
            <p>{t('Άνοιξε τη διεύθυνση, αποθήκευσε το PDF στα Αρχεία σου και μετά κάνε «Εισαγωγή αρχείου» από κάτω.')}</p>
            <button type="button" className="btn mt-2 min-h-9 bg-surface px-3 py-1 text-sm text-ink" onClick={() => void openExternal(blocked)}><IconExternal className="text-base" />{t('Άνοιγμα')}</button>
          </div>
        )}
      </Step>

      <Step n={fromQr.length ? 4 : 3} title={t('Το έχεις ήδη ή δεν υπάρχει ψηφιακό;')} icon={<IconUpload />}>
        <div className="flex flex-col gap-2.5">
          <FilePick accept={DOC_TYPES} multiple disabled={busy} onFiles={(f) => void addLocal(f, 'import')} className="btn btn-plain"><IconUpload className="text-xl" />{t('Εισαγωγή αρχείου')}</FilePick>
          <FilePick accept={IMAGE_TYPES} capture disabled={busy} onFiles={(f) => void addLocal(f, 'scan')} className="btn btn-plain"><IconCamera className="text-xl" />{t('Φωτογράφιση σελίδας')}</FilePick>
        </div>
      </Step>
    </Sheet>
  );
}

function Step({ n, title, icon, children }: { n: number; title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card mt-4 p-4">
      <h3 className="mb-3 flex items-center gap-2.5 text-[15px] font-bold">
        <span className="flex size-7 items-center justify-center rounded-full bg-accent-soft text-[13px] font-extrabold text-accent" aria-hidden="true">{n}</span>
        {title}<span className="ml-auto text-xl text-ink-3">{icon}</span>
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
