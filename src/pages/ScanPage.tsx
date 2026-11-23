/**
 * Σάρωση εντύπου σε τρία βήματα: φωτογραφία του εξωφύλλου ή PDF του εγχειριδίου → ανάλυση στη συσκευή (QR/barcode,
 * κείμενο) → «Τι βρήκαμε», όπου ο χρήστης ελέγχει/διορθώνει και αποθηκεύει. Μετά ανοίγει η καρτέλα του προϊόντος: στην
 * εύρεση του ψηφιακού (φωτογραφία) ή κατευθείαν (PDF: το ψηφιακό υπάρχει ήδη).
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { CATEGORIES, type CategoryId } from '@/domain/categories';
import { emptyItem, newId, type Item, type LinkRef } from '@/domain/model';
import type { CodePayload } from '@/domain/codes';
import { suggestCategory } from '@/domain/categorySuggest';
import { saveItem, useItems } from '@/data/library';
import { blobStore } from '@/data/blobs';
import { scanCover, scanPdf, warmScan, type ScanResult, type ScanStep } from '@/services/scan';
import { isPdf, storeFile } from '@/services/files';
import { t } from '@/i18n';
import { FilePick, IMAGE_TYPES } from '@/components/controls';
import { linkLabel, LinkIcon } from '@/components/item/Links';
import { toast } from '@/components/Toast';
import { IconBack, IconCamera, IconCheck, IconFile, IconImage, IconPlus, IconQr, IconSpark, IconWarn } from '@/components/icons';

type Source = 'photo' | 'pdf';
/** preview: εικόνα εξωφύλλου (object URL)· null όταν δεν υπάρχει ακόμη (PDF πριν διαβαστεί, ή PDF χωρίς εικόνα) */
type Phase = { name: 'start' } | { name: 'working'; source: Source; preview: string | null; step: ScanStep; progress: number } | { name: 'review'; preview: string | null; result: ScanResult };

export default function ScanPage() {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [phase, setPhase] = useState<Phase>({ name: 'start' });
  const preview = phase.name === 'start' ? null : phase.preview;
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  // «Προσθήκη χωρίς σάρωση»: κενό προϊόν και κατευθείαν στην καρτέλα του
  const manual = params.get('manual') === '1';
  const created = useRef(false);
  useEffect(() => {
    if (!manual || created.current) return;
    created.current = true;
    void saveItem(emptyItem()).then((i) => nav(`/item/${i.id}?edit=1`, { replace: true }));
  }, [manual, nav]);

  async function start(file: File) {
    const source: Source = file.type === 'application/pdf' || (await isPdf(file)) ? 'pdf' : 'photo';
    const url = source === 'photo' ? URL.createObjectURL(file) : null;
    setPhase({ name: 'working', source, preview: url, step: 'image', progress: 0 });
    try {
      const onStep = (step: ScanStep, progress = 0) => setPhase({ name: 'working', source, preview: url, step, progress });
      const result = source === 'pdf' ? await scanPdf(file, onStep) : await scanCover(file, onStep);
      setPhase({ name: 'review', preview: url ?? (result.cover ? URL.createObjectURL(result.cover) : null), result });
    } catch {
      setPhase({ name: 'start' });
      toast(source === 'pdf' ? t('Δεν μπόρεσα να ανοίξω αυτό το PDF.') : t('Δεν μπόρεσα να ανοίξω αυτή τη φωτογραφία. Δοκίμασε άλλη.'), 'error');
    }
  }

  // προθέρμανση μόλις ανοίξει η σάρωση: OCR και κωδικοί είναι έτοιμοι όταν έρθει η φωτογραφία
  useEffect(() => { if (!manual) warmScan(); }, [manual]);

  if (manual) return null;
  return (
    <div className="mx-auto max-w-xl px-4 pb-10 pt-[calc(0.75rem+env(safe-area-inset-top))]">
      <div className="flex items-center gap-1 pb-2">
        <button type="button" className="icon-btn -ml-2" onClick={() => (phase.name === 'review' ? setPhase({ name: 'start' }) : nav(-1))} aria-label={t('Πίσω')}><IconBack className="text-2xl" /></button>
        <h1 className="text-xl font-extrabold">{phase.name === 'review' ? t('Τι βρήκαμε') : t('Σάρωση εντύπου')}</h1>
      </div>
      {phase.name === 'start' && <Start onPhoto={start} />}
      {phase.name === 'working' && <Working source={phase.source} preview={phase.preview} step={phase.step} progress={phase.progress} />}
      {phase.name === 'review' && <Review preview={phase.preview} result={phase.result} onSaved={(id) => nav(phase.result.pdf ? `/item/${id}` : `/item/${id}?find=1`, { replace: true })} />}
    </div>
  );
}

function Start({ onPhoto }: { onPhoto: (f: File) => void }) {
  const tips = [t('Η μάρκα και ο κωδικός μοντέλου'), t('Τυχόν QR ή barcode'), t('Καλό φως, χωρίς σκιές')];
  return (
    <div className="pt-2">
      <div className="card overflow-hidden">
        <div className="relative flex aspect-[4/3] items-center justify-center bg-accent-soft text-accent">
          <div className="relative flex h-[62%] w-[46%] flex-col gap-2 rounded-xl bg-surface p-3 shadow-card">
            <div className="h-2.5 w-2/3 rounded-full bg-accent/70" />
            <div className="h-1.5 w-full rounded-full bg-ink-3/30" />
            <div className="h-1.5 w-5/6 rounded-full bg-ink-3/30" />
            <IconQr className="mt-auto self-end text-3xl text-ink-2" />
          </div>
          {/* γωνίες σκόπευσης */}
          {['left-[18%] top-[10%] border-l-4 border-t-4 rounded-tl-2xl', 'right-[18%] top-[10%] border-r-4 border-t-4 rounded-tr-2xl', 'left-[18%] bottom-[10%] border-b-4 border-l-4 rounded-bl-2xl', 'right-[18%] bottom-[10%] border-b-4 border-r-4 rounded-br-2xl'].map((c) => (
            <span key={c} className={`absolute size-8 border-accent ${c}`} aria-hidden="true" />
          ))}
        </div>
        <div className="p-5">
          <h2 className="text-lg font-extrabold">{t('Φωτογράφισε το εξώφυλλο')}</h2>
          <p className="mt-1 text-sm text-ink-2">{t('Να φαίνονται καθαρά:')}</p>
          <ul className="mt-2 space-y-1.5 text-[15px]">
            {tips.map((x) => <li key={x} className="flex items-center gap-2.5"><IconCheck className="shrink-0 text-lg text-ok" />{x}</li>)}
          </ul>
        </div>
      </div>
      <FilePick accept={IMAGE_TYPES} capture onFiles={(f) => onPhoto(f[0]!)} className="btn btn-primary mt-5 w-full py-4 text-base">
        <IconCamera className="text-2xl" />{t('Άνοιγμα κάμερας')}
      </FilePick>
      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        <FilePick accept={IMAGE_TYPES} onFiles={(f) => onPhoto(f[0]!)} className="btn btn-plain">
          <IconImage className="text-xl" />{t('Από τις φωτογραφίες')}
        </FilePick>
        <FilePick accept="application/pdf" onFiles={(f) => onPhoto(f[0]!)} className="btn btn-plain">
          <IconFile className="text-xl" />{t('Εισαγωγή PDF')}
        </FilePick>
      </div>
      <p className="mt-4 text-center text-[13px] leading-relaxed text-ink-3">{t('Η ανάλυση γίνεται στη συσκευή σου. Η φωτογραφία ή το PDF δεν στέλνονται πουθενά.')}</p>
    </div>
  );
}

function Working({ source, preview, step, progress }: { source: Source; preview: string | null; step: ScanStep; progress: number }) {
  const order: ScanStep[] = ['image', 'codes', 'text'];
  const labels: Record<string, string> = source === 'pdf'
    ? { image: t('Ανοίγω το PDF'), codes: t('Ψάχνω QR στην πρώτη σελίδα'), text: t('Διαβάζω το κείμενο') }
    : { image: t('Ετοιμάζω τη φωτογραφία'), codes: t('Ψάχνω QR και barcode'), text: t('Διαβάζω το κείμενο') };
  const at = order.indexOf(step);
  return (
    <div className="pt-2">
      <div className="card relative overflow-hidden">
        {preview
          ? <img src={preview} alt="" className="max-h-[46dvh] w-full bg-surface-2 object-contain" />
          : <div className="flex aspect-[4/3] items-center justify-center bg-surface-2 text-7xl text-ink-3"><IconFile /></div>}
        <span className="animate-scan absolute inset-x-0 h-0.5 bg-accent shadow-[0_0_18px_4px_var(--accent)]" aria-hidden="true" />
      </div>
      <ol className="card mt-4 space-y-3 p-5" aria-live="polite">
        {order.map((s, i) => {
          const state = step === 'done' || i < at ? 'done' : i === at ? 'now' : 'todo';
          return (
            <li key={s} className={`flex items-center gap-3 text-[15px] ${state === 'todo' ? 'text-ink-3' : 'font-semibold'}`}>
              <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm ${state === 'done' ? 'bg-ok-soft text-ok' : state === 'now' ? 'bg-accent-soft text-accent' : 'bg-surface-2'}`}>
                {state === 'done' ? <IconCheck /> : state === 'now' ? <span className="size-2.5 animate-pulse rounded-full bg-accent" /> : null}
              </span>
              <span className="flex-1">{labels[s]}</span>
              {s === 'text' && state === 'now' && <span className="mono text-sm text-ink-2">{Math.round(progress * 100)}%</span>}
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-center text-[13px] text-ink-3">{t('Την πρώτη φορά αργεί λίγο περισσότερο.')}</p>
    </div>
  );
}

function Review({ preview, result, onSaved }: { preview: string | null; result: ScanResult; onSaved: (id: string) => void }) {
  const { found, codes } = result;
  const [brand, setBrand] = useState(found.brands[0] ?? '');
  const [model, setModel] = useState(found.models[0] ?? '');
  const [name, setName] = useState(found.productWord);
  // κατηγορία: προτείνεται από όνομα / μάρκα / μοντέλο / κείμενο και ακολουθεί τις αλλαγές τους, μέχρι να τη διαλέξει ο χρήστης
  const library = useItems();
  const [chosenCategory, setCategory] = useState<CategoryId | null>(null);
  const category = chosenCategory ?? suggestCategory({ name, brand, model, ocrText: result.text }, library) ?? found.category;
  const links = codes.flatMap((c) => (c.type === 'link' ? [c] : []));
  const ean = codes.find((c) => c.type === 'ean')?.code;
  const [keep, setKeep] = useState<Set<string>>(() => new Set(links.map((l) => l.url)));
  const [busy, setBusy] = useState(false);
  const nothing = !found.brands.length && !found.models.length && !codes.length;

  async function save() {
    setBusy(true);
    try {
      const now = Date.now();
      const base = emptyItem(now);
      const attachments: Item['attachments'] = [];
      if (result.cover && result.thumb) {
        const blobId = newId(), thumbId = newId();
        await blobStore.put(blobId, result.cover);
        await blobStore.put(thumbId, result.thumb);
        attachments.push({ id: newId(), kind: 'cover', name: 'cover.jpg', mime: 'image/jpeg', size: result.cover.size, blobId, thumbId, addedAt: now, origin: result.pdf ? 'import' : 'scan' });
      }
      // «Εισαγωγή PDF»: το ίδιο το PDF γίνεται το ψηφιακό εγχειρίδιο του προϊόντος
      if (result.pdf) attachments.push(await storeFile(result.pdf.blob, { kind: 'manual', name: result.pdf.name, origin: 'import' }));
      const item: Item = {
        ...base, name: name.trim(), brand: brand.trim(), model: model.trim(), category, ean,
        ocrText: result.text.slice(0, 20_000) || undefined,
        attachments,
        links: links.filter((l) => keep.has(l.url)).map((l): LinkRef => ({ id: newId(), url: l.url, title: linkLabel(l.kind), kind: l.kind, origin: 'qr', addedAt: now })),
      };
      onSaved((await saveItem(item)).id);
    } catch {
      setBusy(false);
      toast(t('Η αποθήκευση απέτυχε. Ίσως δεν υπάρχει ελεύθερος χώρος.'), 'error');
    }
  }

  return (
    <div className="pt-2">
      <div className="card flex items-center gap-4 p-3">
        {preview
          ? <img src={preview} alt={result.pdf ? t('Η πρώτη σελίδα του PDF') : t('Το εξώφυλλο που φωτογράφισες')} className="size-20 rounded-2xl object-cover" />
          : <span className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-4xl text-ink-3"><IconFile /></span>}
        <p className="text-[15px] leading-snug text-ink-2">
          {nothing
            ? <><IconWarn className="mr-1 inline text-lg text-warn" />{result.pdf ? t('Δεν αναγνώρισα μάρκα ή μοντέλο στο PDF. Συμπλήρωσέ τα εσύ — το PDF θα αποθηκευτεί ως το ψηφιακό εγχειρίδιο.') : t('Δεν αναγνώρισα μάρκα ή μοντέλο. Συμπλήρωσέ τα εσύ — ή δοκίμασε πιο κοντινή φωτογραφία.')}</>
            : <><IconSpark className="mr-1 inline text-lg text-accent" />{t('Έλεγξε ότι τα στοιχεία είναι σωστά. Μπορείς να τα αλλάξεις και αργότερα.')}</>}
        </p>
      </div>

      <div className="card mt-4 space-y-4 p-5">
        <div>
          <label className="label" htmlFor="sc-brand">{t('Μάρκα')}</label>
          <input id="sc-brand" className="input" value={brand} onChange={(e) => setBrand(e.target.value)} autoComplete="off" />
          <Suggestions options={found.brands} value={brand} onPick={setBrand} />
        </div>
        <div>
          <label className="label" htmlFor="sc-model">{t('Μοντέλο')}</label>
          <input id="sc-model" className="input mono" value={model} onChange={(e) => setModel(e.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} />
          <Suggestions options={found.models} value={model} onPick={setModel} mono />
        </div>
        <div>
          <label className="label" htmlFor="sc-name">{t('Όνομα')} <span className="font-normal text-ink-3">({t('προαιρετικό')})</span></label>
          <input id="sc-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('π.χ. Πλυντήριο ρούχων')} />
        </div>
        <div>
          <label className="label" htmlFor="sc-cat">{t('Κατηγορία')}</label>
          <select id="sc-cat" className="input" value={category} onChange={(e) => setCategory(e.target.value as CategoryId)}>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{t(c.label)}</option>)}
          </select>
        </div>
      </div>

      {(links.length > 0 || ean) && (
        <div className="card mt-4 p-5">
          <h2 className="section-title flex items-center gap-2"><IconQr className="text-base" />{t('Κωδικοί στο έντυπο')}</h2>
          <ul className="mt-3 space-y-2.5">
            {links.map((l) => <CodeRow key={l.url} link={l} on={keep.has(l.url)} onToggle={() => setKeep((s) => { const n = new Set(s); if (n.has(l.url)) n.delete(l.url); else n.add(l.url); return n; })} />)}
            {ean && <li className="flex items-center gap-3 rounded-2xl bg-surface-2 px-3.5 py-3 text-[15px]"><span className="text-ink-2">{t('Barcode προϊόντος')}</span><span className="mono ml-auto">{ean}</span></li>}
          </ul>
          {links.length > 0 && <p className="mt-3 text-[13px] leading-relaxed text-ink-3">{t('Οι σύνδεσμοι αποθηκεύονται στην καρτέλα του προϊόντος. Δεν ανοίγουν αυτόματα.')}</p>}
        </div>
      )}

      <button type="button" className="btn btn-primary mt-5 w-full py-4 text-base" disabled={busy} onClick={() => void save()}>
        <IconPlus className="text-xl" />{busy ? t('Αποθήκευση…') : result.pdf ? t('Αποθήκευση προϊόντος') : t('Αποθήκευση και εύρεση ψηφιακού')}
      </button>
    </div>
  );
}

function Suggestions({ options, value, onPick, mono }: { options: string[]; value: string; onPick: (v: string) => void; mono?: boolean }) {
  const rest = options.filter((o) => o !== value).slice(0, 5);
  if (!rest.length) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-[13px] text-ink-3">{t('Ή μήπως:')}</span>
      {rest.map((o) => <button key={o} type="button" className={`chip min-h-8 px-3 text-[13px] ${mono ? 'mono' : ''}`} onClick={() => onPick(o)}>{o}</button>)}
    </div>
  );
}

function CodeRow({ link, on, onToggle }: { link: Extract<CodePayload, { type: 'link' }>; on: boolean; onToggle: () => void }) {
  return (
    <li>
      <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-3.5 py-3 transition ${on ? 'border-accent bg-accent-soft' : 'border-line'}`}>
        <span className="text-2xl text-accent"><LinkIcon kind={link.kind} /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">{linkLabel(link.kind)}</span>
          <span className="mono block truncate text-[13px] text-ink-2">{link.host}</span>
          {link.insecure && <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-warn"><IconWarn className="text-sm" />{t('Μη ασφαλής σύνδεση (http)')}</span>}
        </span>
        <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={on} onChange={onToggle} aria-label={t('Αρχειοθέτηση συνδέσμου {host}', { host: link.host })} />
      </label>
    </li>
  );
}
