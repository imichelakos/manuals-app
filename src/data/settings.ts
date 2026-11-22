/** Ρυθμίσεις αυτής της συσκευής (localStorage): θέμα, μηχανή αναζήτησης, προεπιλεγμένη διάρκεια εγγύησης, κλείδωμα. */
import { useSyncExternalStore } from 'react';
import type { RecyclingRegion } from '@/domain/recyclingTips';
import { CURRENCY_CODE, DEFAULT_CURRENCY } from '@/domain/currency';
import { isSearchEngine, type SearchEngine } from '@/domain/manualSearch';

export type Theme = 'auto' | 'light' | 'dark';
/** lock: κλείδωμα με Face ID / κωδικό συσκευής (ισχύει μόνο όπου υποστηρίζεται, δηλ. στην εφαρμογή iOS) */
/** reminders / reminderDays: ειδοποίηση πριν λήξει μια εγγύηση (στην εφαρμογή iOS), πόσες ημέρες πριν */
/** currency: νόμισμα για νέες τιμές αγοράς — το τελευταίο που διάλεξε ο χρήστης */
/** recyclingRegion: για τις συμβουλές ανακύκλωσης· 'auto' = από τη γλώσσα/περιοχή της συσκευής */
export interface Settings { theme: Theme; engine: SearchEngine; warrantyMonths: number; lock: boolean; reminders: boolean; reminderDays: number; currency: string; recyclingRegion: 'auto' | RecyclingRegion }
export const REMINDER_DAY_OPTIONS = [7, 30, 60] as const;
/** «Άλλο»: οποιοσδήποτε αριθμός ημερών 1–99 */
export const REMINDER_DAYS_MAX = 99;
const DEFAULTS: Settings = { theme: 'auto', engine: 'duckduckgo', warrantyMonths: 24, lock: true, reminders: false, reminderDays: 30, currency: DEFAULT_CURRENCY, recyclingRegion: 'auto' };
const KEY = 'manuals-settings-v1';

function read(): Settings {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>;
    return {
      theme: v.theme === 'light' || v.theme === 'dark' ? v.theme : 'auto',
      engine: isSearchEngine(v.engine) ? v.engine : DEFAULTS.engine,
      warrantyMonths: Number.isInteger(v.warrantyMonths) && v.warrantyMonths! >= 0 && v.warrantyMonths! <= 600 ? v.warrantyMonths! : DEFAULTS.warrantyMonths,
      lock: v.lock !== false,
      reminders: v.reminders === true,
      recyclingRegion: v.recyclingRegion === 'gr' || v.recyclingRegion === 'eu' || v.recyclingRegion === 'world' ? v.recyclingRegion : 'auto',
      currency: typeof v.currency === 'string' && CURRENCY_CODE.test(v.currency) ? v.currency : DEFAULTS.currency,
      reminderDays: Number.isInteger(v.reminderDays) && v.reminderDays! >= 1 && v.reminderDays! <= REMINDER_DAYS_MAX ? v.reminderDays! : DEFAULTS.reminderDays,
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

let themeSetByApp = false;
// στο «όπως η συσκευή» το χρώμα της μπάρας ακολουθεί κι όταν η συσκευή αλλάζει εμφάνιση με την εφαρμογή ανοιχτή
if (typeof window !== 'undefined') window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme());
/**
 * data-theme στο <html> (το theme.css αλλάζει τις μεταβλητές) + χρώμα της μπάρας του browser. Στο «όπως η συσκευή» η
 * εφαρμογή αφαιρεί μόνο τιμή που έβαλε η ίδια: σε σελίδα προεπισκόπησης το data-theme το ορίζει ο host.
 */
export function applyTheme() {
  const root = document.documentElement;
  if (current.theme !== 'auto') { root.setAttribute('data-theme', current.theme); themeSetByApp = true; }
  else if (themeSetByApp) { root.removeAttribute('data-theme'); themeSetByApp = false; }
  const host = root.getAttribute('data-theme');
  const dark = host ? host === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0E1013' : '#F5F3EE');
}
