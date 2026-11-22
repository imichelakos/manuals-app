/** Κατάσταση της λίστας (αναζήτηση, φίλτρα, ταξινόμηση) για όσο είναι ανοιχτή η εφαρμογή — μένει όταν ανοίγεις προϊόν και γυρνάς. */
import { useSyncExternalStore } from 'react';
import { NO_FILTERS, type Filters, type Sort } from '@/domain/search';

export interface ViewState { query: string; filters: Filters; sort: Sort }
let state: ViewState = { query: '', filters: NO_FILTERS, sort: 'relevance' };
const listeners = new Set<() => void>();

export const useViewState = () => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => state);
export function setViewState(patch: Partial<ViewState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}
