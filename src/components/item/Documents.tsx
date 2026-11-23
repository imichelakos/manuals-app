/**
 * Αρχεία του προϊόντος: το ψηφιακό εγχειρίδιο και τα παραστατικά αγοράς (σάρωση με την κάμερα ή εισαγωγή αρχείου).
 * Κοινή γραμμή αρχείου (AttachmentRow) και κοινή προσθήκη (addFiles) για όλα τα είδη.
 */
import { useState } from 'react';
import type { Attachment, AttachmentKind, Item } from '@/domain/model';
import { hasDigitalManual } from '@/domain/model';
import { extractDates } from '@/domain/receiptHints';
import { today } from '@/domain/dates';
import { updateItem } from '@/data/library';
import { blobStore } from '@/data/blobs';
import { FileError, prettySize, storeFile } from '@/services/files';
import { openFile } from '@/services/platform';
import { readText } from '@/services/ocr';
import { useBlobUrl } from '@/hooks/useBlobUrl';
import { fmtDate, t } from '@/i18n';
import { ConfirmDelete, DOC_TYPES, FilePick } from '@/components/controls';
import { Sheet } from '@/components/Sheet';
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

function AttachmentRow({ itemId, a }: { itemId: string; a: Attachment }) {
  const thumb = useBlobUrl(a.thumbId);
  const [view, setView] = useState(false);
  const open = async () => {
    if (a.mime.startsWith('image/')) { setView(true); return; }
    const b = await blobStore.get(a.blobId);
    if (!b) { toast(t('Το αρχείο δεν βρέθηκε σε αυτή τη συσκευή.'), 'error'); return; }
    try { await openFile(b, a.name); } catch { toast(t('Το αρχείο δεν μπόρεσε να ανοίξει εδώ.'), 'error'); }
  };
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-surface-2 p-2">
      <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => void open()}>
        <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface text-2xl text-accent">
          {thumb ? <img src={thumb} alt="" className="size-full object-cover" /> : <IconFile />}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold">{a.name}</span>
          <span className="block text-[13px] text-ink-2">{a.mime === 'application/pdf' ? 'PDF' : t('Εικόνα')} · {prettySize(a.size)}</span>
        </span>
      </button>
      <ConfirmDelete label={t('Διαγραφή αρχείου {name}', { name: a.name })} onConfirm={() => void removeAttachment(itemId, a)} />
      {view && <ImageView a={a} onClose={() => setView(false)} />}
    </li>
  );
}

function ImageView({ a, onClose }: { a: Attachment; onClose: () => void }) {
  const url = useBlobUrl(a.blobId);
  return (
    <Sheet title={a.name} onClose={onClose}>
      {url ? <img src={url} alt={a.name} className="w-full rounded-2xl" /> : <p className="py-10 text-center text-ink-2">{t('Φόρτωση…')}</p>}
    </Sheet>
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

  // firstPage: εικόνα για την πρόταση ημερομηνίας όταν το αρχείο είναι PDF του σαρωτή
  const add = async (files: File[], origin: Attachment['origin'], firstPage?: Blob | null) => {
    setBusy(true);
    try {
      const added = await addFiles(item.id, files, 'receipt', origin);
      // πρόταση ημερομηνίας αγοράς από το κείμενο της απόδειξης (μόνο εικόνες· ο χρήστης αποφασίζει)
      const img = added.find((a) => a.mime.startsWith('image/'));
      const blob = firstPage ?? (img ? await blobStore.get(img.blobId) : null);
      // ημερομηνίες = ψηφία → αγγλικό μοντέλο (το ελληνικό μπερδεύει ψηφία)
      if (blob) setDates(extractDates((await readText(blob, { langs: ['eng'], sparse: false })).eng, today()).filter((d) => d !== item.purchase.date));
    } finally { setBusy(false); }
  };

  return (
    <section className="card p-5">
      <h2 className="section-title">{t('Παραστατικό αγοράς')}</h2>
      {receipts.length === 0
        ? <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{t('Κράτα την απόδειξη ή το τιμολόγιο: χρειάζεται για την εγγύηση.')}</p>
        : <ul className="mt-3 space-y-2.5">{receipts.map((a) => <AttachmentRow key={a.id} itemId={item.id} a={a} />)}</ul>}
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
        <CameraPick mode="document" disabled={busy} onCapture={(c) => void add(c.files, 'scan', c.firstPage)} className="btn btn-plain"><IconCamera className="text-xl" />{t('Σάρωση')}</CameraPick>
        <FilePick accept={DOC_TYPES} multiple disabled={busy} onFiles={(f) => void add(f, 'import')} className="btn btn-plain"><IconUpload className="text-xl" />{t('Αρχείο')}</FilePick>
      </div>
      {busy && <p className="mt-2 text-center text-[13px] text-ink-3" role="status">{t('Αποθήκευση…')}</p>}
    </section>
  );
}
