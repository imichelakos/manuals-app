/**
 * «Βρες το ψηφιακό εγχειρίδιο»: τέσσερις δρόμοι, από τον πιο εύκολο —
 *  1. σύνδεσμος από το QR του εντύπου, 2. έτοιμη αναζήτηση στο διαδίκτυο, 3. επικόλληση διεύθυνσης PDF (κατέβασμα),
 *  4. εισαγωγή αρχείου ή φωτογράφιση των σελίδων. Όταν αποθηκευτεί, προτείνεται η ανακύκλωση του εντύπου.
 * Το κατέβασμα δείχνει πρόοδο και ακυρώνεται· αν η διεύθυνση είναι ιστοσελίδα, προτείνονται τα PDF της (iOS).
 * Στο iOS η αναζήτηση ανοίγει στο Safari της εφαρμογής: «Αποθήκευση στο προϊόν» στην Κοινοποίηση → κατέβασμα εδώ.
 */
import { useEffect, useRef, useState } from 'react';
import { displayName, type Item } from '@/domain/model';
import { classifyCode } from '@/domain/codes';
import { ENGINES, localManualLanguage, manualQueries } from '@/domain/manualSearch';
import { updateItem } from '@/data/library';
import { useSettings } from '@/data/settings';
import { downloadPdf, type DownloadFailure, type DownloadProgress } from '@/services/download';
import type { PdfLink } from '@/domain/pdfLinks';
import { prettySize } from '@/services/files';
import { storeFile } from '@/services/files';
import { manualBrowserAvailable, searchManual } from '@/services/manualBrowser';
import { fmtPercent, languageName, t, userLanguages } from '@/i18n';
import { Sheet } from '@/components/Sheet';
import { ExternalLink } from '@/components/ExternalLink';
import { DOC_TYPES, FilePick } from '@/components/controls';
import { toast } from '@/components/Toast';
import { addFiles } from './Documents';
import { IconCamera, IconCheck, IconDownload, IconExternal, IconQr, IconRecycle, IconSearch, IconUpload } from '@/components/icons';
import { CameraPick } from '@/components/CameraPick';

/** από ποιο βήμα ξεκίνησε το κατέβασμα: εκεί φαίνονται η πρόοδος και τα PDF της σελίδας */
type Source = 'qr' | 'url' | 'search';

const failText = (r: DownloadFailure): string =>
  r === 'bad-url' ? t('Αυτή δεν μοιάζει με διεύθυνση ιστοσελίδας.')
    : r === 'insecure' ? t('Κατεβάζω μόνο από ασφαλείς διευθύνσεις (https).')
    : r === 'not-pdf' ? t('Η διεύθυνση δεν δίνει αρχείο PDF — ίσως είναι η σελίδα που το περιέχει.')
    : r === 'too-big' ? t('Το αρχείο είναι πολύ μεγάλο (όριο 200 MB).')
    : r === 'http' ? t('Ο ιστότοπος απάντησε με σφάλμα — ίσως η διεύθυνση δεν ισχύει πια.')
    : r === 'network' ? t('Το κατέβασμα απέτυχε. Έλεγξε τη σύνδεση και δοκίμασε ξανά.')
    : t('Ο ιστότοπος δεν επιτρέπει απευθείας κατέβασμα από την εφαρμογή.');

export function FindManualSheet({ item, onClose }: { item: Item; onClose: () => void }) {
  const { engine } = useSettings();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  /** κατέβασμα σε εξέλιξη: από ποιο βήμα ξεκίνησε, πρόοδος, ακύρωση */
  const [progress, setProgress] = useState<{ from: Source; p: DownloadProgress | null } | null>(null);
  const abort = useRef<AbortController | null>(null);
  // το φύλλο κλείνει → το κατέβασμα σταματά
  useEffect(() => () => abort.current?.abort(), []);
  /** τα PDF που βρέθηκαν στη σελίδα που δόθηκε αντί για PDF */
  const [found, setFound] = useState<{ from: Source; page: string; links: PdfLink[] } | null>(null);
  const [saved, setSaved] = useState(false);
  const queries = manualQueries(item, engine, localManualLanguage(userLanguages()));
  const labels = { pdf: t('PDF του εγχειριδίου (αγγλικά)'), support: t('Σελίδα υποστήριξης (αγγλικά)'), local: '' };
  const labelOf = (q: (typeof queries)[number]) => (q.id === 'local' ? t('Εγχειρίδιο στα {lang}', { lang: languageName(q.lang) }) : labels[q.id]);
  // σύνδεσμοι από QR που μοιάζουν να οδηγούν στο εγχειρίδιο
  const fromQr = item.links.filter((l) => { const c = classifyCode(l.url); return c.type === 'link' && c.manualHint; });

  /** fromList: διαλέχτηκε από τα PDF της σελίδας — η λίστα μένει (π.χ. μετά από «Άκυρο» ή για άλλο PDF) */
  const fetchPdf = async (target: string, from: Source, fromList = false) => {
    setBusy(true);
    setBlocked(null);
    if (!fromList) setFound(null);
    setProgress({ from, p: null });
    const ctl = new AbortController();
    abort.current = ctl;
    const r = await downloadPdf(target, { signal: ctl.signal, onProgress: (p) => setProgress({ from, p }) });
    abort.current = null;
    setProgress(null);
    if (r.ok) {
      try {
        const a = await storeFile(r.blob, { kind: 'manual', origin: 'download', name: r.name, sourceUrl: target });
        await updateItem(item.id, (c) => ({ ...c, attachments: [...c.attachments, a] }));
        setSaved(true);
      } catch { toast(t('Το αρχείο δεν αποθηκεύτηκε. Ίσως δεν υπάρχει ελεύθερος χώρος.'), 'error'); }
    } else if (r.reason === 'cancelled') {
      // ο χρήστης ακύρωσε: τίποτα άλλο
    } else if (r.links?.length) {
      setFound({ from, page: target, links: r.links });
    } else {
      toast(failText(r.reason), 'error');
      if (r.reason === 'blocked' || r.reason === 'not-pdf' || r.reason === 'http') setBlocked(target);
    }
    setBusy(false);
  };
  /** αναζήτηση στο Safari της εφαρμογής· ό,τι αποθηκεύσει ο χρήστης από την Κοινοποίηση κατεβαίνει εδώ */
  const search = async (target: string) => {
    let saved: string | null = null;
    try { saved = await searchManual(target, t('Αποθήκευση στο προϊόν')); }
    catch { toast(t('Η αναζήτηση δεν άνοιξε. Δοκίμασε ξανά.'), 'error'); }
    if (saved) await fetchPdf(saved, 'search');
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
      <p className="text-[15px] text-ink-2">{displayName(item) || t('Συμπλήρωσε μάρκα και μοντέλο για καλύτερη αναζήτηση.')}{item.name && item.model ? <> · {item.model}</> : null}</p>

      {fromQr.length > 0 && (
        <Step n={1} title={t('Από το QR του εντύπου')} icon={<IconQr />}>
          {fromQr.map((l) => (
            <div key={l.id}>
              <p className="truncate text-[13px] text-ink-2">{l.url.replace(/^https?:\/\//, '')}</p>
              <div className="mt-2 flex gap-2">
                {l.kind === 'pdf' && <button type="button" className="btn btn-soft flex-1" disabled={busy} onClick={() => void fetchPdf(l.url, 'qr')}><IconDownload className="text-lg" />{t('Κατέβασμα')}</button>}
                <ExternalLink href={l.url} className="btn btn-plain flex-1"><IconExternal className="text-lg" />{t('Άνοιγμα')}</ExternalLink>
              </div>
            </div>
          ))}
          {progress?.from === 'qr' && <Progress p={progress.p} onCancel={() => abort.current?.abort()} />}
          {found?.from === 'qr' && <FoundPdfs found={found} busy={busy} onPick={(u) => void fetchPdf(u, 'qr', true)} />}
        </Step>
      )}

      <Step n={fromQr.length ? 2 : 1} title={t('Αναζήτηση στο διαδίκτυο')} icon={<IconSearch />}>
        {queries.length === 0
          ? <p className="text-sm text-ink-2">{t('Συμπλήρωσε πρώτα μάρκα, μοντέλο ή όνομα στην καρτέλα του προϊόντος.')}</p>
          : <>
            <div className="flex flex-col gap-2">
              {queries.map((q) => manualBrowserAvailable
                ? (
                  <button key={q.id} type="button" disabled={busy} className="btn btn-soft justify-between text-left" onClick={() => void search(q.url)}>
                    <span>{labelOf(q)}</span><IconSearch className="shrink-0 text-lg" />
                  </button>
                ) : (
                  <ExternalLink key={q.id} href={q.url} className="btn btn-soft justify-between text-left">
                    <span>{labelOf(q)}</span><IconExternal className="shrink-0 text-lg" />
                  </ExternalLink>
                ))}
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-3">{manualBrowserAvailable
              ? t('Προτίμησε τη σελίδα του κατασκευαστή. Όταν βρεις το εγχειρίδιο ή τη σελίδα του, πάτα Κοινοποίηση και «Αποθήκευση στο προϊόν».')
              : t('Ανοίγει στο {engine}. Προτίμησε τη σελίδα του κατασκευαστή. Αντίγραψε τη διεύθυνση του PDF και γύρνα εδώ.', { engine: ENGINES[engine].name })}</p>
            {progress?.from === 'search' && <Progress p={progress.p} onCancel={() => abort.current?.abort()} />}
            {found?.from === 'search' && <FoundPdfs found={found} busy={busy} onPick={(u) => void fetchPdf(u, 'search', true)} />}
          </>}
      </Step>

      <Step n={fromQr.length ? 3 : 2} title={t('Έχεις τη διεύθυνση του PDF;')} icon={<IconDownload />}>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (url.trim()) void fetchPdf(url.trim(), 'url'); }}>
          <input className="input" type="url" inputMode="url" placeholder="https://…/manual.pdf" value={url} onChange={(e) => setUrl(e.target.value)} aria-label={t('Διεύθυνση του PDF')} autoComplete="off" />
          <button type="submit" className="btn btn-primary shrink-0" disabled={busy || !url.trim()}>{busy ? t('Κατεβάζω…') : t('Κατέβασμα')}</button>
        </form>
        {progress?.from === 'url' && <Progress p={progress.p} onCancel={() => abort.current?.abort()} />}
        {found?.from === 'url' && <FoundPdfs found={found} busy={busy} onPick={(u) => void fetchPdf(u, 'url', true)} />}
        {blocked && (
          <div className="mt-2.5 rounded-2xl bg-warn-soft p-3.5 text-[14px] leading-relaxed text-warn">
            <p>{t('Άνοιξε τη διεύθυνση, αποθήκευσε το PDF στα Αρχεία σου και μετά κάνε «Εισαγωγή αρχείου» από κάτω.')}</p>
            <ExternalLink href={blocked} className="btn mt-2 min-h-9 bg-surface px-3 py-1 text-sm text-ink"><IconExternal className="text-base" />{t('Άνοιγμα')}</ExternalLink>
          </div>
        )}
      </Step>

      <Step n={fromQr.length ? 4 : 3} title={t('Το έχεις ήδη ή δεν υπάρχει ψηφιακό;')} icon={<IconUpload />}>
        <div className="flex flex-col gap-2.5">
          <FilePick accept={DOC_TYPES} multiple disabled={busy} onFiles={(f) => void addLocal(f, 'import')} className="btn btn-plain"><IconUpload className="text-xl" />{t('Εισαγωγή αρχείου')}</FilePick>
          <CameraPick mode="document" disabled={busy} onCapture={(c) => void addLocal(c.files, 'scan')} className="btn btn-plain"><IconCamera className="text-xl" />{t('Φωτογράφιση σελίδας')}</CameraPick>
        </div>
      </Step>
    </Sheet>
  );
}

/** «Κατεβάζω… 42 %» (ή «12,3 MB» όταν ο ιστότοπος δεν δηλώνει μέγεθος), με «Άκυρο». */
function Progress({ p, onCancel }: { p: DownloadProgress | null; onCancel: () => void }) {
  const amount = p?.total ? fmtPercent(Math.min(1, p.bytes / p.total)) : p ? prettySize(p.bytes) : '';
  return (
    <div className="mt-2.5 flex items-center gap-3 rounded-2xl bg-surface-2 p-3" role="status">
      <span className="size-5 shrink-0 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden="true" />
      <span className="flex-1 text-[14px] font-semibold">{amount ? t('Κατεβάζω… {amount}', { amount }) : t('Κατεβάζω…')}</span>
      <button type="button" className="btn btn-plain min-h-9 px-3 py-1 text-sm" onClick={onCancel}>{t('Άκυρο')}</button>
    </div>
  );
}

/** Η διεύθυνση ήταν ιστοσελίδα: τα PDF που βρέθηκαν σε αυτήν· πάτημα → κατέβασμα. */
function FoundPdfs({ found, busy, onPick }: { found: { page: string; links: PdfLink[] }; busy: boolean; onPick: (url: string) => void }) {
  return (
    <div className="mt-2.5 rounded-2xl bg-surface-2 p-3">
      <p className="text-[14px] leading-snug">{t('Η διεύθυνση είναι ιστοσελίδα. Βρήκα σε αυτήν αυτά τα PDF — διάλεξε το εγχειρίδιο:')}</p>
      <ul className="mt-2 space-y-1.5">
        {found.links.map((l) => (
          <li key={l.url}>
            <button type="button" disabled={busy} onClick={() => onPick(l.url)}
              className="flex w-full items-center gap-2.5 rounded-xl bg-surface p-2.5 text-left disabled:opacity-50">
              <IconDownload className="shrink-0 text-lg text-accent" />
              <span className="min-w-0">
                <span className="line-clamp-2 break-words text-[14px] font-semibold leading-snug">{l.title}</span>
                <span className="block truncate text-[12px] text-ink-2">{l.url.replace(/^https:\/\//, '')}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
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
