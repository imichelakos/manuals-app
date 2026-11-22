/**
 * Κλείδωμα της εφαρμογής με Face ID / Touch ID (ή κωδικό συσκευής), όταν είναι ενεργό στις Ρυθμίσεις και η συσκευή
 * το υποστηρίζει. Κλειδώνει στην εκκίνηση και όταν η εφαρμογή επιστρέφει αφού έμεινε στο παρασκήνιο πάνω από 60 s.
 * Το όριο υπάρχει γιατί η κάμερα και ο επιλογέας αρχείων του iOS βγάζουν για λίγο την εφαρμογή στο παρασκήνιο: ένα
 * κλείδωμα στη μέση μιας σάρωσης θα ήταν ενοχλητικό χωρίς να προσθέτει ασφάλεια.
 *
 * Τι προστατεύει: την ΟΘΟΝΗ (κάποιος με ξεκλείδωτο το κινητό σου δεν ανοίγει την εφαρμογή). Τα δεδομένα στον δίσκο
 * προστατεύονται ανεξάρτητα, με την κρυπτογράφηση (data/vault), είτε είναι ενεργό το κλείδωμα είτε όχι.
 */
import { useSyncExternalStore } from 'react';
import { biometricAuth, biometricSupported } from '@/services/deviceSecurity';
import { getSettings } from './settings';

const RELOCK_AFTER_MS = 60_000;

export const lockSupported = biometricSupported;
const active = () => lockSupported && getSettings().lock;

let locked = active();
let hiddenAt: number | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
    if (hiddenAt !== null && Date.now() - hiddenAt > RELOCK_AFTER_MS && active()) { locked = true; emit(); }
    hiddenAt = null;
  });
}

export const useLocked = (): boolean => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => locked && active());

export async function unlock(reason: string): Promise<boolean> {
  const ok = await biometricAuth(reason);
  if (ok) { locked = false; emit(); }
  return ok;
}

/**
 * Επιβεβαίωση ταυτότητας πριν από ενέργειες που βγάζουν ή σβήνουν δεδομένα (εξαγωγή/εισαγωγή αντιγράφου, διαγραφή όλων,
 * απενεργοποίηση του κλειδώματος). Όταν το κλείδωμα δεν είναι ενεργό, δεν ζητά τίποτα.
 */
export async function confirmIdentity(reason: string): Promise<boolean> {
  return active() ? biometricAuth(reason) : true;
}
