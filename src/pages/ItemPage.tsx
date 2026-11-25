/** Η καρτέλα ενός προϊόντος: εγχειρίδιο, σύνδεσμοι, εγγύηση, παραστατικό, στοιχεία, σημειώσεις. Κάθε αλλαγή αποθηκεύεται μόνη της. */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { categoryById } from '@/domain/categories';
import { coverOf, displayName } from '@/domain/model';
import { deleteItem, useItem } from '@/data/library';
import { useBlobUrl } from '@/hooks/useBlobUrl';
import { useWide } from '@/hooks/useWide';
import { t } from '@/i18n';
import { CategoryIcon } from '@/components/categoryIcons';
import { ConfirmDelete } from '@/components/controls';
import { WarrantyBadge } from '@/components/WarrantyBadge';
import { ManualSection, OtherDocsSection, ReceiptSection } from '@/components/item/Documents';
import { FindManualSheet } from '@/components/item/FindManualSheet';
import { LinksSection } from '@/components/item/Links';
import { WarrantySection } from '@/components/item/Warranty';
import { DetailsSection, NotesSection } from '@/components/item/Details';
import { RecyclingTipsSection } from '@/components/item/RecyclingTips';
import { toast } from '@/components/Toast';
import { IconBack } from '@/components/icons';
import { CoverPhoto } from '@/components/item/CoverPhoto';

export default function ItemPage() {
  const { id } = useParams();
  const item = useItem(id);
  const nav = useNavigate();
  const wide = useWide();
  const [params, setParams] = useSearchParams();
  // μετά τη σάρωση (?find=1) ανοίγει κατευθείαν η εύρεση του ψηφιακού
  const [find, setFind] = useState(() => params.get('find') === '1');
  // μόνο τότε: το εγχειρίδιο κατεβαίνει αυτόματα από το QR του εντύπου, αν υπάρχει
  const [autoQr] = useState(() => params.get('find') === '1');
  // νέο προϊόν χωρίς σάρωση (?edit=1): τα στοιχεία ανοίγουν κατευθείαν σε επεξεργασία
  const [startEditing] = useState(() => params.get('edit') === '1');
  const cover = item ? coverOf(item) : undefined;
  const coverUrl = useBlobUrl(cover?.blobId);

  // το ?find / ?edit φεύγει από τη διεύθυνση, για να μην ξανανοίξει με «πίσω» ή ανανέωση
  useEffect(() => { if (params.size) setParams({}, { replace: true }); }, [params, setParams]);

  if (!item) {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center">
        <p className="text-lg font-bold">{t('Το προϊόν δεν υπάρχει πια')}</p>
        <Link to="/" className="btn btn-soft mt-4">{t('Στη βιβλιοθήκη')}</Link>
      </div>
    );
  }

  const title = displayName(item) || t('Χωρίς όνομα');
  const remove = async () => { await deleteItem(item.id); toast(t('Το προϊόν διαγράφηκε')); nav('/', { replace: true }); };

  return (
    <article className="mx-auto max-w-2xl px-4 pb-10 pt-[calc(0.5rem+env(safe-area-inset-top))]">
      <div className="flex items-center justify-between">
        {wide ? <span /> : <button type="button" className="icon-btn -ml-2" onClick={() => nav('/')} aria-label={t('Πίσω στη βιβλιοθήκη')}><IconBack className="text-2xl" /></button>}
        <ConfirmDelete label={t('Διαγραφή προϊόντος')} onConfirm={() => void remove()} className="icon-btn -mr-2" />
      </div>

      <header className="flex items-center gap-4 pb-5 pt-1">
        <CoverPhoto item={item} title={title}>
          {coverUrl ? <img src={coverUrl} alt={t('Εξώφυλλο εντύπου')} className="size-full object-cover" /> : <CategoryIcon id={item.category} />}
        </CoverPhoto>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold leading-tight">{title}</h1>
          {item.name && (item.brand || item.model) && <p className="mt-0.5 text-[15px] text-ink-2">{item.brand} {item.model}</p>}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="badge badge-mute"><CategoryIcon id={item.category} className="text-sm" />{t(categoryById(item.category).label)}</span>
            <WarrantyBadge item={item} short />
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-4">
        {/* διάταξη «Ταυτότητα πρώτα» (23/11/2026) */}
        <DetailsSection item={item} startEditing={startEditing || (!item.name && !item.brand && !item.model)} />
        <ManualSection item={item} onFind={() => setFind(true)} />
        <WarrantySection item={item} />
        <ReceiptSection item={item} />
        <LinksSection item={item} />
        <OtherDocsSection item={item} />
        <NotesSection item={item} />
        <RecyclingTipsSection item={item} />
      </div>

      {find && <FindManualSheet item={item} autoQr={autoQr} onClose={() => setFind(false)} />}
    </article>
  );
}
