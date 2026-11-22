/** Εγγύηση: πότε λήγει και σε τι κατάσταση είναι σήμερα. Καθαρός υπολογισμός από τα πεδία του προϊόντος. */
import type { Item } from './model';
import { addMonths, daysBetween, type IsoDate } from './dates';

export type WarrantyState = 'none' | 'active' | 'expiring' | 'expired';
/** «λήγει σύντομα»: μένουν το πολύ τόσες ημέρες */
export const EXPIRING_DAYS = 60;

export interface WarrantyInfo { state: WarrantyState; until: IsoDate | null; daysLeft: number | null }

/** Λήξη: η ρητή ημερομηνία αν υπάρχει, αλλιώς ημερομηνία αγοράς + διάρκεια. null αν δεν φτάνουν τα στοιχεία. */
export function warrantyUntil(i: Pick<Item, 'purchase' | 'warranty'>): IsoDate | null {
  if (i.warranty.until) return i.warranty.until;
  if (i.purchase.date && i.warranty.months) return addMonths(i.purchase.date, i.warranty.months);
  return null;
}

export function warrantyInfo(i: Pick<Item, 'purchase' | 'warranty'>, todayIso: IsoDate): WarrantyInfo {
  const until = warrantyUntil(i);
  const daysLeft = until ? daysBetween(todayIso, until) : null;
  if (until === null || daysLeft === null) return { state: 'none', until: null, daysLeft: null };
  // η ημέρα λήξης μετρά ως καλυμμένη
  const state: WarrantyState = daysLeft < 0 ? 'expired' : daysLeft <= EXPIRING_DAYS ? 'expiring' : 'active';
  return { state, until, daysLeft };
}
