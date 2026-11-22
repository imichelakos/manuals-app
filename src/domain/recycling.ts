/**
 * Δείκτες ανακύκλωσης της βιβλιοθήκης: πόσα έντυπα ανακυκλώθηκαν, πόσα είναι έτοιμα (υπάρχει το ψηφιακό αλλά το χαρτί
 * κρατιέται ακόμη) και πόσα περιμένουν ψηφιακό. Μόνο πλήθη από τα δεδομένα του χρήστη — καμία εκτίμηση βάρους/CO2.
 */
import { hasDigitalManual, type Item } from './model';

export interface RecyclingStats {
  total: number;
  recycled: number;
  ready: number;
  waiting: number;
  /** ποσοστό 0–100 των προϊόντων με ανακυκλωμένο έντυπο (ακέραιο) */
  recycledPct: number;
  /** ποσοστό 0–100 των προϊόντων που έχουν ψηφιακό εγχειρίδιο */
  digitalPct: number;
}

export function recyclingStats(items: readonly Item[]): RecyclingStats {
  const live = items.filter((i) => !i.deleted);
  let recycled = 0, ready = 0, waiting = 0, digital = 0;
  for (const i of live) {
    const has = hasDigitalManual(i);
    if (has) digital++;
    if (i.paper === 'recycled') recycled++;
    else if (has) ready++;
    else waiting++;
  }
  const pct = (n: number) => (live.length ? Math.round((n / live.length) * 100) : 0);
  return { total: live.length, recycled, ready, waiting, recycledPct: pct(recycled), digitalPct: pct(digital) };
}
