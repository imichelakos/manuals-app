/**
 * Άνοιγμα ενός αρχείου του προϊόντος για ανάγνωση, ίδιο παντού (έγγραφα, φωτογραφία):
 * iPhone/iPad → QuickLook μέσα στην εφαρμογή (services/filePreview)· web → οι εικόνες σε φύλλο, τα PDF σε νέα καρτέλα.
 * Η `open` επιστρέφει το αντίγραφο με σημειώσεις (μόνο QuickLook με `editable`)· τι θα γίνει με αυτό το αποφασίζει ο καλών.
 */
import { useCallback, useState, type ReactNode } from 'react';
import type { Attachment } from '@/domain/model';
import { blobStore } from '@/data/blobs';
import { lockActive } from '@/data/appLock';
import { previewAvailable, previewFile } from '@/services/filePreview';
import { openFile } from '@/services/platform';
import { useBlobUrl } from '@/hooks/useBlobUrl';
import { Sheet } from '@/components/Sheet';
import { toast } from '@/components/Toast';
import { t } from '@/i18n';

export interface ViewOptions { title: string; editable?: boolean }

export function useFileViewer(): { open: (a: Attachment, o: ViewOptions) => Promise<Blob | null>; viewer: ReactNode } {
  const [image, setImage] = useState<{ blobId: string; title: string } | null>(null);
  const open = useCallback(async (a: Attachment, o: ViewOptions): Promise<Blob | null> => {
    if (!previewAvailable && a.mime.startsWith('image/')) { setImage({ blobId: a.blobId, title: o.title }); return null; }
    const b = await blobStore.get(a.blobId);
    if (!b) { toast(t('Το αρχείο δεν βρέθηκε σε αυτή τη συσκευή.'), 'error'); return null; }
    try {
      if (previewAvailable) return await previewFile(b, a.name, { title: o.title, editable: o.editable, closeOnBackground: lockActive() });
      await openFile(b, a.name);
    } catch { toast(t('Το αρχείο δεν μπόρεσε να ανοίξει εδώ.'), 'error'); }
    return null;
  }, []);
  const viewer = image && <ImageView blobId={image.blobId} title={image.title} onClose={() => setImage(null)} />;
  return { open, viewer };
}

function ImageView({ blobId, title, onClose }: { blobId: string; title: string; onClose: () => void }) {
  const url = useBlobUrl(blobId);
  return (
    <Sheet title={title} onClose={onClose}>
      {url ? <img src={url} alt={title} className="w-full rounded-2xl" /> : <p className="py-10 text-center text-ink-2">{t('Φόρτωση…')}</p>}
    </Sheet>
  );
}
