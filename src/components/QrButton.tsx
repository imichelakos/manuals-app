/**
 * «Σάρωση QR»: ζωντανή σάρωση της Apple όπου υπάρχει (iOS 16+, A12+), αλλιώς φωτογραφία (σαρωτής/κάμερα) και ανάγνωση.
 * Κοινό για την καρτέλα (Σύνδεσμοι) και τη σάρωση εντύπου (QR σε άλλη σελίδα από το εξώφυλλο).
 */
import { useEffect, useState, type ReactNode } from 'react';
import type { CodePayload } from '@/domain/codes';
import { codesFromPhoto, liveQrSupported, scanQrLive } from '@/services/qrScanner';
import { CameraPick } from '@/components/CameraPick';
import { toast } from '@/components/Toast';
import { IconQr } from '@/components/icons';
import { t } from '@/i18n';

/** onCodes: οι κωδικοί που διαβάστηκαν (κενό: τίποτα)· null: ο χρήστης ακύρωσε */
export function QrButton({ onCodes, className = 'btn btn-plain', children }: { onCodes: (c: CodePayload[] | null) => void; className?: string; children?: ReactNode }) {
  const [live, setLive] = useState(false);
  useEffect(() => { let on = true; void liveQrSupported().then((s) => { if (on) setLive(s); }); return () => { on = false; }; }, []);
  const label = children ?? <><IconQr className="text-xl" />{t('Σάρωση QR')}</>;
  if (live) return <button type="button" className={className} onClick={() => void scanQrLive().then(onCodes, () => toast(t('Η σάρωση απέτυχε. Δοκίμασε ξανά.'), 'error'))}>{label}</button>;
  return <CameraPick mode="photo" className={className} onCapture={(c) => void codesFromPhoto(c.files[0]!).then(onCodes, () => onCodes([]))}>{label}</CameraPick>;
}

/** Μήνυμα όταν η σάρωση δεν έδωσε σύνδεσμο: τίποτα, barcode προϊόντος ή κείμενο. */
export function noLinkMessage(codes: CodePayload[]): string {
  const other = codes[0];
  return !other ? t('Δεν βρέθηκε QR. Δοκίμασε πιο κοντά.')
    : other.type === 'ean' ? t('Είναι barcode προϊόντος ({c}), όχι σύνδεσμος.', { c: other.code })
    : t('Το QR δεν περιέχει σύνδεσμο.');
}
