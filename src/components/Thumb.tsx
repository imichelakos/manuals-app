/** Μικρογραφία προϊόντος: η φωτογραφία του εξωφύλλου, αλλιώς το εικονίδιο της κατηγορίας. */
import { coverOf, type Item } from '@/domain/model';
import { useBlobUrl } from '@/hooks/useBlobUrl';
import { CategoryIcon } from './categoryIcons';

export function Thumb({ item, className = '' }: { item: Item; className?: string }) {
  const cover = coverOf(item);
  const url = useBlobUrl(cover?.thumbId ?? cover?.blobId);
  return (
    <div className={`flex shrink-0 items-center justify-center overflow-hidden bg-surface-2 text-ink-3 ${className}`}>
      {url ? <img src={url} alt="" className="size-full object-cover" /> : <CategoryIcon id={item.category} className="text-[1.6em]" />}
    </div>
  );
}
