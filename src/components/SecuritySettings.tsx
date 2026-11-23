/** Ρυθμίσεις → Ασφάλεια: κλείδωμα με Face ID (μόνο στην εφαρμογή iOS) και τι κρυπτογραφείται. */
import { useEffect, useState } from 'react';
import { confirmIdentity, lockSupported } from '@/data/appLock';
import { setSettings, useSettings } from '@/data/settings';
import { biometricInfo, keychainAvailable, nativeDiagnostics } from '@/services/deviceSecurity';
import { productReaderStatus, type ProductReaderStatus } from '@/services/productReader';
import { t } from '@/i18n';

export function SecuritySettings() {
  const { lock } = useSettings();
  const [label, setLabel] = useState('Face ID');
  const diag = nativeDiagnostics();
  const [available, setAvailable] = useState(lockSupported);
  useEffect(() => { void biometricInfo().then((i) => { setAvailable(i.available); if (i.label) setLabel(i.label); }); }, []);
  const [device, setDevice] = useState<ProductReaderStatus | null>(null);
  useEffect(() => { void productReaderStatus().then(setDevice); }, []);

  const toggle = async () => {
    // το κλείσιμο του κλειδώματος θέλει επιβεβαίωση· το άνοιγμα όχι
    if (lock && !(await confirmIdentity(t('Επιβεβαίωση για απενεργοποίηση του κλειδώματος')))) return;
    setSettings({ lock: !lock });
  };

  return (
    <div className="space-y-3 py-3">
      {lockSupported && (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[15px] font-semibold">{t('Κλείδωμα με {label}', { label })}</p>
            <p className="mt-0.5 text-[13px] leading-snug text-ink-2">
              {available ? t('Μόλις βγεις από την εφαρμογή (όχι για κάμερα ή αρχεία).') : t('Δεν έχει οριστεί Face ID, Touch ID ή κωδικός σε αυτή τη συσκευή.')}
            </p>
          </div>
          <button type="button" role="switch" aria-checked={lock && available} disabled={!available} aria-label={t('Κλείδωμα με {label}', { label })} onClick={() => void toggle()}
            className={`relative h-8 w-14 shrink-0 rounded-full transition disabled:opacity-40 ${lock && available ? 'bg-ok' : 'bg-surface-2'}`}>
            <span className={`absolute top-1 size-6 rounded-full bg-surface shadow-card transition-all ${lock && available ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
      )}
      <p className="text-[13px] leading-snug text-ink-2">{t('Τα δεδομένα αποθηκεύονται κρυπτογραφημένα (AES-256).')}</p>
      {/* κατάσταση: δείχνει αν η εφαρμογή βρίσκει το Keychain και το Face ID της συσκευής (χρήσιμο σε δοκιμές) */}
      <details className="text-[13px]">
        <summary className="cursor-pointer font-semibold text-ink-2">{t('Τεχνικά στοιχεία')}</summary>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-2xl bg-surface-2 p-3 leading-snug">
          <dt className="text-ink-2">{t('Κλειδί κρυπτογράφησης')}</dt>
          <dd className="font-semibold">{keychainAvailable ? t('Keychain της συσκευής') : t('αποθήκη του browser')}</dd>
          <dt className="text-ink-2">{t('Κλείδωμα')}</dt>
          <dd className="font-semibold">{!lockSupported ? t('δεν υποστηρίζεται εδώ') : available ? t('{label} διαθέσιμο', { label }) : t('χωρίς Face ID / κωδικό')}</dd>
          <dt className="text-ink-2">{t('Διάγνωση')}</dt>
          <dd className="break-all text-[12px]">{diag.platform} · {diag.plugins.join(', ') || '—'}<br />native: {diag.native}</dd>
          {device && <>
            <dt className="text-ink-2">{t('Συσκευή')}</dt>
            <dd className="break-all text-[12px]">iOS {device.ios} · {device.device} · SDK {device.sdk || '—'} · Xcode {device.xcode || '—'}</dd>
            <dt className="text-ink-2">{t('AI στη συσκευή')}</dt>
            <dd className="text-[12px] font-semibold">{device.ai}</dd>
          </>}
        </dl>
      </details>
    </div>
  );
}
