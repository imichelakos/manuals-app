import { Link } from 'react-router';
import { displayName, hasDigitalManual, type Item } from '@/domain/model';
import { t } from '@/i18n';
import { Thumb } from './Thumb';
import { WarrantyBadge } from './WarrantyBadge';
import { IconCheck, IconRecycle } from './icons';

/** Γραμμή προϊόντος στη λίστα. */
export function ItemCard({ item, selected }: { item: Item; selected: boolean }) {
  const sub = [item.brand, item.model].filter(Boolean);
  return (
    <Link to={`/item/${item.id}`} aria-current={selected ? 'page' : undefined}
      className={`flex items-center gap-3.5 rounded-3xl p-3 transition active:scale-[0.99] ${selected ? 'bg-accent-soft' : 'bg-surface shadow-card'}`}>
      <Thumb item={item} className="size-16 rounded-2xl text-xl" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] font-bold leading-snug">{displayName(item) || t('Χωρίς όνομα')}</p>
        {sub.length > 0 && item.name && (
          <p className="truncate text-sm text-ink-2">{item.brand}{item.brand && item.model ? ' · ' : ''}<span className="mono text-[13px]">{item.model}</span></p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {hasDigitalManual(item)
            ? <span className="badge badge-ok"><IconCheck className="text-sm" />{t('Ψηφιακό')}</span>
            : <span className="badge badge-mute">{t('Χωρίς ψηφιακό')}</span>}
          <WarrantyBadge item={item} short />
          {item.paper === 'recycled' && <span className="badge badge-ok" title={t('Το έντυπο ανακυκλώθηκε')}><IconRecycle className="text-sm" /><span className="sr-only">{t('Το έντυπο ανακυκλώθηκε')}</span></span>}
        </div>
      </div>
    </Link>
  );
}
