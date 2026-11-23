/** Ρυθμίσεις αυτής της συσκευής (localStorage): θέμα, μηχανή αναζήτησης (μόνο για δοκιμές), κλείδωμα, υπενθυμίσεις. */
import { useSyncExternalStore } from 'react';
import { normalizeOffsets } from '@/domain/reminders';
import { CURRENCY_CODE, DEFAULT_CURRENCY } from '@/domain/currency';
import { isSearchEngine, type SearchEngine } from '@/domain/manualSearch';

export type Theme = 'auto' | 'light' | 'dark';
/** lock: κλείδωμα με Face ID / κωδικό συσκευής (ισχύει μόνο όπου υποστηρίζεται, δηλ. στην εφαρμογή iOS) */
/** reminders / reminderDays: ειδοποιήσεις πριν λήξει μια εγγύηση (στην εφαρμογή iOS)· έως 5 «πόσες ημέρες πριν» */
/** currency: νόμισμα για νέες τιμές αγοράς — το τελευταίο που διάλεξε ο χρήστης */
/** webBrand: επιβεβαίωση μάρκας στο Wikidata με λέξεις του εξωφύλλου (ενεργή από προεπιλογή· στην πολιτική απορρήτου) */
export interface Settings { theme: Theme; engine: SearchEngine; webBrand: boolean; lock: boolean; reminders: boolean; reminderDays: number[]; currency: string }
export const REMINDER_DAY_OPTIONS = [7, 30, 60] as const;
/** «Άλλο»: οποιοσδήποτε αριθμός ημερών 1–99 */
export const REMINDER_DAYS_MAX = 99;
const DEFAULTS: Settings = { theme: 'auto', engine: 'duckduckgo', webBrand: true, lock: true, reminders: false, reminderDays: [30], currency: DEFAULT_CURRENCY };
const KEY = 'manuals-settings-v1';

function read(): Settings {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>;
    return {
      theme: v.theme === 'light' || v.theme === 'dark' ? v.theme : 'auto',
      engine: isSearchEngine(v.engine) ? v.engine : DEFAULTS.engine,
      webBrand: v.webBrand !== false,
      lock: v.lock !== false,
      reminders: v.reminders === true,
      currency: typeof v.currency === 'string' && CURRENCY_CODE.test(v.currency) ? v.currency : DEFAULTS.currency,
      // παλιά ρύθμιση: ένας αριθμός → λίστα ενός στοιχείου
      reminderDays: normalizeOffsets(v.reminderDays).length ? normalizeOffsets(v.reminderDays) : DEFAULTS.reminderDays,
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
