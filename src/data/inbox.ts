/**
 * Λίστα ειδοποιήσεων της εφαρμογής: οι υπενθυμίσεις εγγύησης που έχουν ήδη «χτυπήσει» (domain/reminders → dueReminders)
 * μένουν εδώ μέχρι να τις σβήσει ο χρήστης. Οι σβησμένες κρατιούνται ως κλειδιά σε αυτή τη συσκευή (localStorage).
 */
import { useMemo, useSyncExternalStore } from 'react';
import { dueReminders, type DueReminder } from '@/domain/reminders';
import { today } from '@/domain/dates';
import { useItems } from './library';
import { useSettings } from './settings';

const KEY = 'manuals-inbox-dismissed-v1';
/** πόσο πίσω κρατιούνται: μετά από αυτό μια παλιά ειδοποίηση φεύγει μόνη της */
const LOOKBACK_DAYS = 365;

const read = (): Set<string> => { try { return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]); } catch { return new Set(); } };
let dismissed = read();
const listeners = new Set<() => void>();
function save(next: Set<string>) {
  dismissed = next;
  try { localStorage.setItem(KEY, JSON.stringify([...next].slice(-2000))); } catch { /* χωρίς αποθήκευση: ισχύει για τη συνεδρία */ }
  listeners.forEach((l) => l());
}
const useDismissed = () => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => dismissed);

export function dismiss(keys: string[]): void { save(new Set([...dismissed, ...keys])); }

/** Οι ειδοποιήσεις που δεν έχει σβήσει ο χρήστης, νεότερες πρώτα. */
export function useInbox(): DueReminder[] {
  const items = useItems();
  const { reminderDays } = useSettings();
  const gone = useDismissed();
  const now = today();
  return useMemo(() => dueReminders(items, { today: now, daysBefore: reminderDays, lookbackDays: LOOKBACK_DAYS }).filter((r) => !gone.has(r.key)),
    [items, reminderDays, gone, now]);
}
