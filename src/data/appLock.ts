/**
 * Κλείδωμα της εφαρμογής με Face ID / Touch ID (ή κωδικό συσκευής), όταν είναι ενεργό στις Ρυθμίσεις και η συσκευή
 * το υποστηρίζει. Κλειδώνει στην εκκίνηση και ΑΜΕΣΩΣ μόλις η εφαρμογή πάει στο παρασκήνιο — έτσι η οθόνη κλειδώματος
 * είναι ήδη εκεί όταν επιστρέφεις (και στην εικόνα του app switcher, όσο προλαβαίνει να σχεδιαστεί).
 * Εξαίρεση: έξοδοι που ζήτησε η ίδια η εφαρμογή (κάμερα, επιλογέας αρχείων, φύλλο Safari — services/appSwitch). Εκεί
 * κλειδώνει μόνο αν η επιστροφή αργήσει πάνω από 10 λεπτά.
 *
 * Τι προστατεύει: την ΟΘΟΝΗ (κάποιος με ξεκλείδωτο το κινητό σου δεν ανοίγει την εφαρμογή). Τα δεδομένα στον δίσκο
 * προστατεύονται ανεξάρτητα, με την κρυπτογράφηση (data/vault), είτε είναι ενεργό το κλείδωμα είτε όχι.
 */
import { useSyncExternalStore } from 'react';
import { biometricAuth, biometricSupported } from '@/services/deviceSecurity';
import { appSwitchExpected, clearAppSwitch } from '@/services/appSwitch';
import { getSettings } from './settings';

const EXPECTED_SWITCH_MAX_MS = 10 * 60_000;

export const lockSupported = biometricSupported;
const active = () => lockSupported && getSettings().lock;

let locked = active();
/** πότε έφυγε η εφαρμογή για έξοδο που ζήτησε η ίδια (null: δεν είναι σε τέτοια έξοδο) */
let expectedSince: number | null = null;
const listeners = new Set<() => void>();
const lock = () => { if (!locked) { locked = true; listeners.forEach((l) => l()); } };

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!active()) return;
    if (document.visibilityState === 'hidden') {
      if (appSwitchExpected()) expectedSince = Date.now();
      else lock();
      return;
    }
    if (expectedSince !== null && Date.now() - expectedSince > EXPECTED_SWITCH_MAX_MS) lock();
    expectedSince = null;
    clearAppSwitch();
  });
}

export const useLocked = (): boolean => useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => locked && active());

export async function unlock(reason: string): Promise<boolean> {
  const ok = await biometricAuth(reason);
  if (ok) { locked = false; listeners.forEach((l) => l()); }
  return ok;
}

/**
 * Επιβεβαίωση ταυτότητας πριν από ενέργειες που βγάζουν ή σβήνουν δεδομένα (εξαγωγή/εισαγωγή αντιγράφου, διαγραφή όλων,
 * απενεργοποίηση του κλειδώματος). Όταν το κλείδωμα δεν είναι ενεργό, δεν ζητά τίποτα.
 */
export async function confirmIdentity(reason: string): Promise<boolean> {
  return active() ? biometricAuth(reason) : true;
}
