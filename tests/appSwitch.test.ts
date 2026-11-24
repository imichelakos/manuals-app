import test from 'node:test';
import assert from 'node:assert/strict';
import { appSwitchExpected, clearAppSwitch } from '@/services/appSwitch';
import { scanQrLive } from '@/services/qrScanner';
import { scanDocument } from '@/services/documentScanner';

// Οι native σαρωτές καλύπτουν την εφαρμογή (η σελίδα γίνεται «hidden»). Αν δεν δηλωθεί πριν ότι η έξοδος είναι
// αναμενόμενη, το κλείδωμα ζητά Face ID στην επιστροφή — σφάλμα που βρέθηκε στο iPhone (24/11/2026, «Σάρωση QR»).
for (const [name, open] of [['σάρωση QR', () => scanQrLive()], ['σαρωτής εγγράφων', () => scanDocument('document')]] as const) {
  test(`${name}: δηλώνει αναμενόμενη έξοδο πριν ανοίξει (χωρίς Face ID στην επιστροφή)`, async () => {
    clearAppSwitch();
    assert.equal(appSwitchExpected(), false);
    await open().catch(() => {}); // εδώ (Node) δεν υπάρχει native plugin· μετρά μόνο η δήλωση
    assert.equal(appSwitchExpected(), true);
  });
}
