/** Ρυθμίσεις αυτής της συσκευής (localStorage): θέμα, μηχανή αναζήτησης, προεπιλεγμένη διάρκεια εγγύησης. */
import { useSyncExternalStore } from 'react';
import type { SearchEngine } from '@/domain/manualSearch';

export type Theme = 'auto' | 'light' | 'dark';
export interface Settings { theme: Theme; engine: SearchEngine; warrantyMonths: number }
const DEFAULTS: Settings = { theme: 'auto', engine: 'duckduckgo', warrantyMonths: 24 };
const KEY = 'manuals-settings-v1';

function read(): Settings {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>;
    return {
      theme: v.theme === 'light' || v.theme === 'dark' ? v.theme : 'auto',
      engine: v.engine === 'google' ? 'google' : 'duckduckgo',
      warrantyMonths: Number.isInteger(v.warrantyMonths) && v.warrantyMonths! >= 0 && v.warrantyMonths! <= 600 ? v.warrantyMonths! : DEFAULTS.warrantyMonths,
    };
  } catch { return DEFAULTS; }
}

let current = read();
const listeners = new Set<() => void>();

export const getSettings = () => current;
export function setSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* χωρίς αποθήκευση: ισχύει για αυτή τη συνεδρία */ }
  applyTheme();
  listeners.forEach((l) => l());
}
export const useSettings = () => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => current);

/** data-theme στο <html> (το theme.css αλλάζει τις μεταβλητές) + χρώμα της μπάρας του browser. */
export function applyTheme() {
  const root = document.documentElement;
  if (current.theme === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', current.theme);
  const dark = current.theme === 'dark' || (current.theme === 'auto' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0E1013' : '#F5F3EE');
}
