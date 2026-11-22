/**
 * Εμφανίζεται ΑΝΤΙ για την εφαρμογή όταν τα δεδομένα δεν μπορούν να ανοίξουν ή να αποθηκευτούν με ασφάλεια
 * (data/vault). Τίποτα δεν γράφεται ή σβήνεται χωρίς ρητή απόφαση του χρήστη.
 */
import { useState } from 'react';
import { destroyLocalData, type VaultStatus } from '@/data/vault';
import { t } from '@/i18n';
import { IconWarn } from './icons';

export function VaultProblem({ status }: { status: Exclude<VaultStatus, 'ready'> }) {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const discard = async () => { setBusy(true); await destroyLocalData(); location.reload(); };
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-bg px-8 text-center">
      <span className="flex size-16 items-center justify-center rounded-3xl bg-warn-soft text-3xl text-warn"><IconWarn /></span>
      <p className="text-xl font-extrabold">{status === 'locked' ? t('Τα δεδομένα δεν ανοίγουν') : t('Η ασφαλής αποθήκευση δεν είναι διαθέσιμη')}</p>
      <p className="max-w-sm text-[15px] leading-relaxed text-ink-2">
        {status === 'locked'
          ? t('Το κλειδί κρυπτογράφησης αυτής της συσκευής λείπει ή δεν ταιριάζει με τα αποθηκευμένα δεδομένα. Αυτό μπορεί να συμβεί μετά από επαναφορά της συσκευής.')
          : t('Δεν δημιουργήθηκε κλειδί κρυπτογράφησης, οπότε η εφαρμογή δεν αποθηκεύει τίποτα. Δοκίμασε ξανά σε λίγο.')}
      </p>
      <button type="button" className="btn btn-primary min-w-56" onClick={() => location.reload()}>{t('Δοκίμασε ξανά')}</button>
      {status === 'locked' && (confirm ? (
        <div className="mt-2 max-w-sm rounded-3xl bg-bad-soft p-4 text-bad">
          <p className="text-[14px] leading-relaxed">{t('Θα σβηστούν τα δεδομένα αυτής της συσκευής. Αν είχες ανοιχτό τον συγχρονισμό iCloud, θα ξανακατέβουν όταν τον ανοίξεις. Συνέχεια;')}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn flex-1 bg-surface text-ink" onClick={() => setConfirm(false)}>{t('Άκυρο')}</button>
            <button type="button" className="btn btn-danger flex-1" disabled={busy} onClick={() => void discard()}>{t('Ναι, διαγραφή')}</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-ghost text-bad" onClick={() => setConfirm(true)}>{t('Συνέχεια χωρίς αυτά τα δεδομένα')}</button>
      ))}
    </div>
  );
}
