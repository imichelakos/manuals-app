import { useSyncExternalStore } from 'react';

const QUERY = '(min-width: 900px)'; // ίδιο όριο με το breakpoint «wide» του index.css
const mq = typeof window !== 'undefined' ? window.matchMedia(QUERY) : null;

/** Πλατιά οθόνη (iPad, υπολογιστής): λίστα και καρτέλα προϊόντος δίπλα-δίπλα. */
export const useWide = (): boolean =>
  useSyncExternalStore((l) => { mq?.addEventListener('change', l); return () => mq?.removeEventListener('change', l); }, () => mq?.matches ?? false);
