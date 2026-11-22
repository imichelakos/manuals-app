/**
 * «Η εφαρμογή βγαίνει για λίγο στο παρασκήνιο επειδή το ζήτησε η ίδια»: κάμερα / επιλογέας αρχείων, φύλλο Safari,
 * φύλλο κοινοποίησης, το παράθυρο του Face ID. Όποιος ανοίγει κάτι τέτοιο το δηλώνει εδώ λίγο πριν· το κλείδωμα
 * (data/appLock) ρωτά μετά αν η έξοδος ήταν αναμενόμενη, για να μην κλειδώσει στη μέση μιας σάρωσης.
 */
const WINDOW_MS = 30_000;
let expectedUntil = 0;

export function expectAppSwitch(): void { expectedUntil = Date.now() + WINDOW_MS; }
export const appSwitchExpected = (): boolean => Date.now() < expectedUntil;
export function clearAppSwitch(): void { expectedUntil = 0; }
