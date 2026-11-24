/**
 * Καρτέλα προϊόντος → φωτογραφία: πάτημα → προβολή σε πλήρη οθόνη (QuickLook στο iPhone)· το κουμπί κάμερας στη γωνία →
 * νέα φωτογραφία (σαρωτής/κάμερα), από τις φωτογραφίες, ή αφαίρεση. Χωρίς φωτογραφία, το πάτημα ανοίγει κατευθείαν την
 * προσθήκη. Η νέα αντικαθιστά την παλιά (και τα αρχεία της)· δεν ξαναγίνεται αναγνώριση — τα στοιχεία μένουν ως έχουν.
 */
import { useState, type ReactNode } from 'react';
import { coverOf, type Item } from '@/domain/model';
import { updateItem } from '@/data/library';
import { blobStore } from '@/data/blobs';
import { storeFile } from '@/services/files';
import { CameraPick } from '@/components/CameraPick';
import { useFileViewer } from '@/components/FileViewer';
import { FilePick, IMAGE_TYPES } from '@/components/controls';
import { Sheet } from '@/components/Sheet';
import { toast } from '@/components/Toast';
import { IconCamera, IconImage, IconTrash } from '@/components/icons';
import { t } from '@/i18n';

async function setCover(item: Item, file: Blob | null, origin: 'scan' | 'import') {
  const old = coverOf(item);
  const next = file ? await storeFile(file, { kind: 'cover', name: 'cover.jpg', origin }) : null;
  await updateItem(item.id, (c) => ({ ...c, attachments: [...c.attachments.filter((a) => a.kind !== 'cover'), ...(next ? [next] : [])] }));
  if (old) await blobStore.remove(old.thumbId ? [old.blobId, old.thumbId] : [old.blobId]);
}

/** Το πλακίδιο της φωτογραφίας στην κεφαλίδα· `children`: η εικόνα ή το εικονίδιο κατηγορίας· `title`: για την προβολή. */
export function CoverPhoto({ item, title, children }: { item: Item; title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const cover = coverOf(item);
  const has = !!cover;
  const { open: view, viewer } = useFileViewer();
  const run = async (file: Blob | null, origin: 'scan' | 'import') => {
    setBusy(true);
    try { await setCover(item, file, origin); setOpen(false); }
    catch { toast(t('Η φωτογραφία δεν αποθηκεύτηκε.'), 'error'); }
    finally { setBusy(false); }
  };
  return (
    <>
      <div className="relative shrink-0">
        <button type="button" onClick={() => (cover ? void view(cover, { title }) : setOpen(true))}
          aria-label={cover ? t('Προβολή φωτογραφίας') : t('Προσθήκη φωτογραφίας')}
          className="flex size-24 items-center justify-center overflow-hidden rounded-3xl bg-surface text-4xl text-ink-3 shadow-card">
          {children}
        </button>
        {has && (
          <button type="button" onClick={() => setOpen(true)} aria-label={t('Αλλαγή φωτογραφίας')}
            className="absolute -bottom-1.5 -right-1.5 flex size-9 items-center justify-center rounded-full border-2 border-bg bg-surface text-lg text-accent shadow-card">
            <IconCamera />
          </button>
        )}
      </div>
      {viewer}
      {open && (
        <Sheet title={has ? t('Αλλαγή φωτογραφίας') : t('Προσθήκη φωτογραφίας')} onClose={() => setOpen(false)}>
          <div className="flex flex-col gap-2.5">
            <CameraPick mode="photo" disabled={busy} onCapture={(c) => void run(c.files[0]!, 'scan')} className="btn btn-primary"><IconCamera className="text-xl" />{t('Νέα φωτογραφία')}</CameraPick>
            <FilePick accept={IMAGE_TYPES} disabled={busy} onFiles={(f) => void run(f[0]!, 'import')} className="btn btn-plain"><IconImage className="text-xl" />{t('Από τις φωτογραφίες')}</FilePick>
            {has && <button type="button" disabled={busy} className="btn btn-plain text-bad" onClick={() => void run(null, 'import')}><IconTrash className="text-xl" />{t('Αφαίρεση φωτογραφίας')}</button>}
          </div>
        </Sheet>
      )}
    </>
  );
}
