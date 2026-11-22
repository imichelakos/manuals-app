/** Ρυθμίσεις → Ασφάλεια: κλείδωμα με Face ID (μόνο στην εφαρμογή iOS) και τι κρυπτογραφείται. */
import { useEffect, useState } from 'react';
import { confirmIdentity, lockSupported } from '@/data/appLock';
import { setSettings, useSettings } from '@/data/settings';
import { biometricInfo } from '@/services/deviceSecurity';
import { t } from '@/i18n';

export function SecuritySettings() {
  const { lock } = useSettings();
  const [label, setLabel] = useState('Face ID');
  const [available, setAvailable] = useState(lockSupported);
  useEffect(() => { void biometricInfo().then((i) => { setAvailable(i.available); if (i.label) setLabel(i.label); }); }, []);

  const toggle = async () => {
    // το κλείσιμο του κλειδώματος θέλει επιβεβαίωση· το άνοιγμα όχι
    if (lock && !(await confirmIdentity(t('Επιβεβαίωση για απενεργοποίηση του κλειδώματος')))) return;
    setSettings({ lock: !lock });
  };

  return (
    <div className="space-y-3">
      <p className="text-[15px] leading-relaxed text-ink-2">
        {t('Τα προϊόντα, οι σημειώσεις και τα αρχεία σου αποθηκεύονται κρυπτογραφημένα (AES-256). Το αντίγραφο ασφαλείας .zip δεν είναι κρυπτογραφημένο.')}
      </p>
      {lockSupported && (
        <div className="flex items-center gap-3">
          <button type="button" role="switch" aria-checked={lock && available} disabled={!available} aria-label={t('Κλείδωμα με {label}', { label })} onClick={() => void toggle()}
            className={`relative h-8 w-14 shrink-0 rounded-full transition disabled:opacity-40 ${lock && available ? 'bg-ok' : 'bg-surface-2'}`}>
            <span className={`absolute top-1 size-6 rounded-full bg-surface shadow-card transition-all ${lock && available ? 'left-7' : 'left-1'}`} />
          </button>
          <div>
            <p className="text-[15px] font-semibold">{t('Κλείδωμα με {label}', { label })}</p>
            <p className="text-[13px] leading-snug text-ink-2">
              {available ? t('Στο άνοιγμα της εφαρμογής και όταν επιστρέφεις μετά από 1 λεπτό.') : t('Δεν έχει οριστεί Face ID, Touch ID ή κωδικός σε αυτή τη συσκευή.')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
