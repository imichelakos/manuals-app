/**
 * Κλείδωμα της εφαρμογής με Face ID / Touch ID (ή κωδικό συσκευής), όταν είναι ενεργό στις Ρυθμίσεις και η συσκευή
 * το υποστηρίζει. Κλειδώνει στην εκκίνηση και ΑΜΕΣΩΣ μόλις η εφαρμογή πάει στο παρασκήνιο — έτσι η οθόνη κλειδώματος
 * είναι ήδη εκεί όταν επιστρέφεις (και στην εικόνα του app switcher, όσο προλαβαίνει να σχεδιαστεί).
 * «Παρασκήνιο» = το «pause» του iOS (Capacitor: UIScene.didEnterBackgroundNotification), ΟΧΙ η ορατότητα της σελίδας:
 * η σελίδα κρύβεται και όταν ανοίγει μια οθόνη μέσα στην εφαρμογή (προβολή αρχείου, σαρωτής, κάμερα, Face ID), και
 * τότε δεν ζητείται Face ID, όση ώρα κι αν μείνει ανοιχτή. Οι οθόνες αυτές κλείνουν στο παρασκήνιο (services/nativeScreens).
 *
 * Τι προστατεύει: την ΟΘΟΝΗ (κάποιος με ξεκλείδωτο το κινητό σου δεν ανοίγει την εφαρμογή). Τα δεδομένα στον δίσκο
 * προστατεύονται ανεξάρτητα, με την κρυπτογράφηση (data/vault), είτε είναι ενεργό το κλείδωμα είτε όχι.
 */
import { useSyncExternalStore } from 'react';
import { biometricAuth, biometricSupported } from '@/services/deviceSecurity';
import { setCloseOnBackground } from '@/services/nativeScreens';
import { getSettings } from './settings';

export const lockSupported = biometricSupported;
const active = () => lockSupported && getSettings().lock;

let locked = active();
const listeners = new Set<() => void>();
const lock = () => { if (!locked) { locked = true; listeners.forEach((l) => l()); } };

// με ενεργό κλείδωμα, οι οθόνες του iOS κλείνουν στο παρασκήνιο (αλλιώς θα έμεναν πάνω από την οθόνη κλειδώματος)
setCloseOnBackground(active);
if (typeof document !== 'undefined') document.addEventListener('pause', () => { if (active()) lock(); });

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
