import { useSyncExternalStore } from 'react';

/** Τι αναφέρει η συσκευή στη σελίδα: σκοτεινή εμφάνιση (prefers-color-scheme); ενημερώνεται όταν αλλάζει. */
const query = () => window.matchMedia?.('(prefers-color-scheme: dark)');
export const usePrefersDark = (): boolean => useSyncExternalStore(
  (l) => { const q = query(); q?.addEventListener('change', l); return () => q?.removeEventListener('change', l); },
  () => query()?.matches ?? false,
);
