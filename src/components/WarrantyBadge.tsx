/** Κατάσταση εγγύησης ως ετικέτα: «Εγγύηση έως …», «Λήγει σε Ν ημέρες», «Έληξε». */
import type { Item } from '@/domain/model';
import { coveredParts, warrantyInfo, type WarrantyInfo } from '@/domain/warranty';
import { today } from '@/domain/dates';
import { fmtDate, t, tn } from '@/i18n';
import { IconShield } from './icons';

export function warrantyText(w: WarrantyInfo): string {
  if (w.state === 'none' || w.daysLeft === null || !w.until) return t('Χωρίς στοιχεία εγγύησης');
  if (w.state === 'expired') return t('Η εγγύηση έληξε στις {date}', { date: fmtDate(w.until) });
  if (w.state === 'expiring') return w.daysLeft === 0 ? t('Η εγγύηση λήγει σήμερα') : tn(w.daysLeft, 'Η εγγύηση λήγει σε {n} ημέρα', 'Η εγγύηση λήγει σε {n} ημέρες');
  return t('Εγγύηση έως {date}', { date: fmtDate(w.until) });
}

export function WarrantyBadge({ item, short = false }: { item: Item; short?: boolean }) {
  const w = warrantyInfo(item, today());
  if (w.state === 'none') return null;
  const cls = w.state === 'active' ? 'badge-ok' : w.state === 'expiring' ? 'badge-warn' : 'badge-bad';
  const label = !short ? warrantyText(w)
    : w.state === 'expired' ? t('Έληξε')
    : w.state === 'expiring' ? tn(w.daysLeft ?? 0, '{n} ημέρα', '{n} ημέρες')
    : t('έως {date}', { date: fmtDate(w.until!) });
  return <span className={`badge ${cls}`}><IconShield className="text-sm" />{label}</span>;
}

/** «+N μέρη σε εγγύηση»: όταν η κύρια εγγύηση έχει λήξει (ή δεν υπάρχει) αλλά καλύπτονται ακόμη μέρη του προϊόντος. */
export function PartsBadge({ item }: { item: Item }) {
  const now = today();
  const main = warrantyInfo(item, now).state;
  if (main === 'active' || main === 'expiring') return null;
  const n = coveredParts(item, now).length;
  if (!n) return null;
  return <span className="badge badge-ok"><IconShield className="text-sm" />{tn(n, '+{n} μέρος σε εγγύηση', '+{n} μέρη σε εγγύηση')}</span>;
}
