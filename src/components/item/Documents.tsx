/**
 * Αρχεία του προϊόντος: το ψηφιακό εγχειρίδιο και τα παραστατικά αγοράς (σάρωση με την κάμερα ή εισαγωγή αρχείου).
 * Κοινή γραμμή αρχείου (AttachmentRow) και κοινή προσθήκη (addFiles) για όλα τα είδη.
 */
import { useState } from 'react';
import type { Attachment, AttachmentKind, Item } from '@/domain/model';
import { hasDigitalManual } from '@/domain/model';
import { checkReceipt, extractDates } from '@/domain/receiptHints';
import { today } from '@/domain/dates';
import { updateItem } from '@/data/library';
import { blobStore } from '@/data/blobs';
import { FileError, prettySize, storeFile } from '@/services/files';
import { readReceipt } from '@/services/receiptReader';
import { useBlobUrl } from '@/hooks/useBlobUrl';
import { useFileViewer } from '@/components/FileViewer';
import { fmtDate, t } from '@/i18n';
import { AutoField, ConfirmDelete, DOC_TYPES, FilePick, TitleField } from '@/components/controls';
import { toast } from '@/components/Toast';
import { IconCamera, IconCheck, IconFile, IconRecycle, IconSearch, IconUpload } from '@/components/icons';
import { CameraPick } from '@/components/CameraPick';

const fileErrorText = (e: unknown) =>
  e instanceof FileError && e.code === 'too-big' ? t('Το αρχείο είναι πολύ μεγάλο (όριο 200 MB).')
    : e instanceof FileError && e.code === 'unsupported' ? t('Δεκτά είναι αρχεία PDF και εικόνες.')
    : t('Το αρχείο δεν αποθηκεύτηκε. Ίσως δεν υπάρχει ελεύθερος χώρος.');

/** Αποθηκεύει αρχεία ως συνημμένα του προϊόντος· επιστρέφει όσα μπήκαν. Τα σφάλματα εμφανίζονται ως μήνυμα. */
export async function addFiles(itemId: string, files: File[], kind: AttachmentKind, origin: Attachment['origin']): Promise<Attachment[]> {
  const added: Attachment[] = [];
  for (const f of files) {
    try { added.push(await storeFile(f, { kind, origin, name: f.name || (kind === 'receipt' ? t('Παραστατικό') : t('Εγχειρίδιο')) })); }
    catch (e) { toast(fileErrorText(e), 'error'); }
  }
  if (added.length) await updateItem(itemId, (c) => ({ ...c, attachments: [...c.attachments, ...added] }));
  return added;
}

async function removeAttachment(itemId: string, a: Attachment) {
  await updateItem(itemId, (c) => ({ ...c, attachments: c.attachments.filter((x) => x.id !== a.id) }));
  await blobStore.remove(a.thumbId ? [a.blobId, a.thumbId] : [a.blobId]);
}

/** τίτλοι που προτείνονται για συμπληρωματικά έγγραφα (μέχρι να γράψει ο χρήστης δικό του) */
const otherTitles = () => [t('Δήλωση συμμόρφωσης'), t('Οδηγίες εγκατάστασης'), t('Φύλλο σέρβις'), t('Πιστοποιητικό εγγύησης')];
const EXT = /\.(pdf|jpg)$/i;
/** τίτλος χωρίς κατάληξη (η κατάληξη μένει στο όνομα: χρειάζεται όταν το αρχείο ανοίγει ή μοιράζεται) */
const titleOf = (name: string) => name.replace(EXT, '');
const genericName = (name: string) => titleOf(name) === t('Έγγραφο') || /^scan-\d{8}-\d{6}$/.test(titleOf(name));
/** νέος τίτλος → όνομα αρχείου με την ίδια κατάληξη, χωρίς χαρακτήρες που δεν επιτρέπονται σε ονόματα αρχείων */
const renamed = (name: string, title: string) => `${[...title].map((ch) => (ch.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(ch) ? ' ' : ch)).join('').trim().slice(0, 120) || t('Έγγραφο')}${name.match(EXT)?.[0] ?? ''}`;

/**
 * Το αντίγραφο με τις σημειώσεις (QuickLook) μπαίνει ως νέο έγγραφο στα «Άλλα έγγραφα», με τον τίτλο του αρχικού και
 * «(με σημειώσεις)»· το αρχικό μένει όπως ήταν.
 */
async function addMarkedCopy(itemId: string, a: Attachment, marked: Blob) {
  const name = renamed(a.name, t('{title} (με σημειώσεις)', { title: titleOf(a.name) }));
  const added = await addFiles(itemId, [new File([marked], name, { type: marked.type })], 'other', a.origin);
  if (added.length) toast(t('Το αντίγραφο με τις σημειώσεις μπήκε στα «Άλλα έγγραφα».'));
}

/** Γραμμή αρχείου: άνοιγμα και διαγραφή· με `editable`, και τίτλος / σημείωση που αλλάζουν επιτόπου. */
function AttachmentRow({ itemId, a, editable = false }: { itemId: string; a: Attachment; editable?: boolean }) {
  const thumb = useBlobUrl(a.thumbId);
  const { open: view, viewer } = useFileViewer();
  const open = async () => {
    const marked = await view(a, { title: titleOf(a.name), editable: true });
    if (marked) await addMarkedCopy(itemId, a, marked);
  };
  const patch = (p: Partial<Attachment>) => void updateItem(itemId, (c) => ({ ...c, attachments: c.attachments.map((x) => (x.id === a.id ? { ...x, ...p } : x)) }));
  const kindLine = `${a.mime === 'application/pdf' ? 'PDF' : t('Εικόνα')} · ${prettySize(a.size)}`;
  const icon = (
    <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface text-2xl text-accent">
      {thumb ? <img src={thumb} alt="" className="size-full object-cover" /> : <IconFile />}
    </span>
  );
  return (
    <li className="rounded-2xl bg-surface-2 p-2">
      <div className="flex items-center gap-3">
        {editable ? (
          <>
            <button type="button" className="shrink-0" onClick={() => void open()} aria-label={t('Άνοιγμα {name}', { name: a.name })}>{icon}</button>
            <span className="min-w-0 flex-1">
              <TitleField title={genericName(a.name) ? '' : titleOf(a.name)} placeholder={t('Τίτλος εγγράφου')} fieldLabel={t('Τίτλος εγγράφου')}
                onCommit={(v) => patch({ name: renamed(a.name, v) })} />
              <span className="block text-[13px] text-ink-2">{kindLine}</span>
            </span>
          </>
        ) : (
          <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => void open()}>
            {icon}
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold">{a.name}</span>
              <span className="block text-[13px] text-ink-2">{kindLine}</span>
            </span>
          </button>
        )}
        <ConfirmDelete label={t('Διαγραφή αρχείου {name}', { name: a.name })} onConfirm={() => void removeAttachment(itemId, a)} />
      </div>
      {editable && (
        <div className="mt-1.5 px-1">
          {genericName(a.name) && (
            <div className="mb-1.5 flex flex-wrap gap-1.5">
              {otherTitles().map((x) => <button key={x} type="button" className="chip min-h-8 px-3 text-[13px]" onClick={() => patch({ name: renamed(a.name, x) })}>{x}</button>)}
            </div>
          )}
          <AutoField value={a.note ?? ''} placeholder={t('Σημείωση (προαιρετική)')} aria-label={t('Σημείωση εγγράφου')}
            className="w-full rounded-lg bg-surface px-2.5 py-1.5 text-[14px] outline-hidden" onCommit={(v) => patch({ note: v.trim() || undefined })} />
        </div>
      )}
      {viewer}
    </li>
  );
}

export function ManualSection({ item, onFind }: { item: Item; onFind: () => void }) {
  const manuals = item.attachments.filter((a) => a.kind === 'manual');
  const has = hasDigitalManual(item);
  const recycled = item.paper === 'recycled';
  const setPaper = (paper: Item['paper']) => void updateItem(item.id, (c) => ({ ...c, paper }));
  return (
    <section className="card p-5">
      <h2 className="section-title">{t('Ψηφιακό εγχειρίδιο')}</h2>
      {has ? (
        <ul className="mt-3 space-y-2.5">{manuals.map((a) => <AttachmentRow key={a.id} itemId={item.id} a={a} />)}</ul>
      ) : (
        <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{t('Δεν έχεις ακόμη το ψηφιακό. Βρες το και κράτα το εδώ, για να μη χρειάζεσαι το χαρτί.')}</p>
      )}
      <button type="button" className={`btn mt-3 w-full ${has ? 'btn-plain' : 'btn-primary'}`} onClick={onFind}>
        <IconSearch className="text-xl" />{has ? t('Προσθήκη ή αναζήτηση άλλου') : t('Βρες το ψηφιακό εγχειρίδιο')}
      </button>

      <div className={`mt-4 flex flex-wrap items-center gap-x-3.5 gap-y-3 rounded-2xl p-3.5 ${recycled ? 'bg-ok-soft text-ok' : 'bg-surface-2'}`}>
        <span className="text-3xl"><IconRecycle /></span>
        <div className="min-w-40 flex-1">
          <p className="text-[15px] font-bold">{recycled ? t('Το έντυπο ανακυκλώθηκε') : has ? t('Έτοιμο για ανακύκλωση') : t('Κράτα το έντυπο προς το παρόν')}</p>
          <p className={`text-[13px] leading-snug ${recycled ? '' : 'text-ink-2'}`}>
            {recycled ? t('Μπράβο — ένα χαρτί λιγότερο στο συρτάρι.') : has ? t('Έχεις το ψηφιακό. Το χαρτί μπορεί να πάει στην ανακύκλωση.') : t('Μέχρι να αποθηκεύσεις το ψηφιακό.')}
          </p>
        </div>
        {recycled
          ? <button type="button" className="btn min-h-10 grow bg-surface px-4 py-1 text-sm text-ink xs:grow-0" onClick={() => setPaper('kept')}>{t('Αναίρεση')}</button>
          : <button type="button" className="btn btn-primary min-h-10 grow px-4 py-1 text-sm xs:grow-0" disabled={!has} onClick={() => { setPaper('recycled'); toast(t('Σημειώθηκε ως ανακυκλωμένο')); }}><IconCheck className="text-base" />{t('Το ανακύκλωσα')}</button>}
      </div>
    </section>
  );
}

export function ReceiptSection({ item }: { item: Item }) {
  const receipts = item.attachments.filter((a) => a.kind === 'receipt');
  const [busy, setBusy] = useState(false);
  const [dates, setDates] = useState<string[]>([]);
  // αρχεία που δεν μοιάζουν με παραστατικό: περιμένουν απάντηση του χρήστη πριν αποθηκευτούν
  const [doubt, setDoubt] = useState<{ files: File[]; origin: Attachment['origin']; dates: string[] } | null>(null);
  const [phase, setPhase] = useState<'check' | 'save'>('save');

  const store = async (files: File[], origin: Attachment['origin'], found: string[]) => {
    setPhase('save');
    const added = await addFiles(item.id, files, 'receipt', origin);
    if (added.length) setDates(found.filter((d) => d !== item.purchase.date)); // πρόταση· ο χρήστης αποφασίζει
  };

  // firstPage: η εικόνα της 1ης σελίδας όταν το αρχείο είναι PDF του σαρωτή
  const add = async (files: File[], origin: Attachment['origin'], firstPage?: Blob | null) => {
    setBusy(true);
    setDoubt(null);
    try {
      setPhase('check');
      const r = await readReceipt(files, firstPage);
      const found = r ? extractDates(r.dateText, today()) : [];
      // δεν μοιάζει με παραστατικό → ερώτηση πριν από την αποθήκευση· χωρίς κείμενο (π.χ. PDF στο web) δεν ρωτάμε
      if (r && !checkReceipt(r.text, today()).likely) { setDoubt({ files, origin, dates: found }); return; }
      await store(files, origin, found);
    } finally { setBusy(false); }
  };
  const confirmDoubt = async () => {
    if (!doubt) return;
    const d = doubt;
    setDoubt(null);
    setBusy(true);
    try { await store(d.files, d.origin, d.dates); } finally { setBusy(false); }
  };

  return (
    <section className="card p-5">
      <h2 className="section-title">{t('Παραστατικό αγοράς')}</h2>
      {receipts.length === 0
        ? <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{t('Κράτα την απόδειξη ή το τιμολόγιο: χρειάζεται για την εγγύηση.')}</p>
        : <ul className="mt-3 space-y-2.5">{receipts.map((a) => <AttachmentRow key={a.id} itemId={item.id} a={a} />)}</ul>}
      {doubt && (
        <div className="mt-3 rounded-2xl bg-warn-soft p-3.5 text-warn" role="alert">
          <p className="text-[14px] font-semibold">{t('Δεν μοιάζει με παραστατικό αγοράς')}</p>
          <p className="mt-0.5 text-[13px] leading-snug">{t('Δεν βρέθηκε ημερομηνία μαζί με ποσό ή στοιχεία απόδειξης. Να αποθηκευτεί παρ’ όλα αυτά;')}</p>
          <div className="mt-2.5 flex gap-2">
            <button type="button" className="btn btn-plain min-h-10 flex-1 bg-surface text-ink" onClick={() => setDoubt(null)}>{t('Άκυρο')}</button>
            <button type="button" className="btn btn-primary min-h-10 flex-1" onClick={() => void confirmDoubt()}>{t('Αποθήκευση')}</button>
          </div>
        </div>
      )}
      {dates.length > 0 && (
        <div className="mt-3 rounded-2xl bg-accent-soft p-3.5">
          <p className="text-[13px] font-semibold text-accent">{t('Ημερομηνία αγοράς από την απόδειξη;')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {dates.map((d) => (
              <button key={d} type="button" className="chip border-transparent bg-surface text-ink" onClick={() => { void updateItem(item.id, (c) => ({ ...c, purchase: { ...c.purchase, date: d } })); setDates([]); }}>{fmtDate(d)}</button>
            ))}
            <button type="button" className="chip border-transparent bg-transparent" onClick={() => setDates([])}>{t('Όχι, ευχαριστώ')}</button>
          </div>
        </div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <CameraPick mode="document" disabled={busy || !!doubt} onCapture={(c) => void add(c.files, 'scan', c.firstPage)} className="btn btn-plain"><IconCamera className="text-xl" />{t('Σάρωση')}</CameraPick>
        <FilePick accept={DOC_TYPES} multiple disabled={busy || !!doubt} onFiles={(f) => void add(f, 'import')} className="btn btn-plain"><IconUpload className="text-xl" />{t('Αρχείο')}</FilePick>
      </div>
      {busy && <p className="mt-2 text-center text-[13px] text-ink-3" role="status">{phase === 'check' ? t('Έλεγχος του παραστατικού…') : t('Αποθήκευση…')}</p>}
    </section>
  );
}

/** Συμπληρωματικά έγγραφα (δήλωση συμμόρφωσης, φύλλο σέρβις, οδηγίες εγκατάστασης…): σάρωση ή αρχείο, με τίτλο και σημείωση. */
export function OtherDocsSection({ item }: { item: Item }) {
  const docs = item.attachments.filter((a) => a.kind === 'other');
  const [busy, setBusy] = useState(false);
  const add = async (files: File[], origin: Attachment['origin']) => {
    setBusy(true);
    try {
      // ο τίτλος αρχίζει γενικός («Έγγραφο»): ο χρήστης διαλέγει από τις προτάσεις ή γράφει δικό του
      await addFiles(item.id, files.map((f) => new File([f], t('Έγγραφο'), { type: f.type })), 'other', origin);
    } finally { setBusy(false); }
  };
  return (
    <section className="card p-5">
      <h2 className="section-title">{t('Άλλα έγγραφα')}</h2>
      {docs.length === 0
        ? <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{t('Δήλωση συμμόρφωσης, φύλλο σέρβις, οδηγίες εγκατάστασης — ό,τι άλλο συνοδεύει το προϊόν.')}</p>
        : <ul className="mt-3 space-y-2.5">{docs.map((a) => <AttachmentRow key={a.id} itemId={item.id} a={a} editable />)}</ul>}
      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <CameraPick mode="document" disabled={busy} onCapture={(c) => void add(c.files, 'scan')} className="btn btn-plain"><IconCamera className="text-xl" />{t('Σάρωση')}</CameraPick>
        <FilePick accept={DOC_TYPES} multiple disabled={busy} onFiles={(f) => void add(f, 'import')} className="btn btn-plain"><IconUpload className="text-xl" />{t('Αρχείο')}</FilePick>
      </div>
      {busy && <p className="mt-2 text-center text-[13px] text-ink-3" role="status">{t('Αποθήκευση…')}</p>}
    </section>
  );
}
