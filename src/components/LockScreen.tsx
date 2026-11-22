/** Οθόνη κλειδώματος: καλύπτει όλη την εφαρμογή μέχρι να πετύχει το Face ID. Ζητά Face ID μόλις εμφανιστεί. */
import { useEffect, useRef, useState } from 'react';
import { unlock } from '@/data/appLock';
import { biometricInfo } from '@/services/deviceSecurity';
import { t } from '@/i18n';
import { IconShield } from './icons';

export function LockScreen() {
  const [label, setLabel] = useState('Face ID');
  const asked = useRef(false);
  const ask = () => void unlock(t('Ξεκλείδωμα των εγχειριδίων σου'));
  useEffect(() => {
    void biometricInfo().then((i) => { if (i.label) setLabel(i.label); });
    if (!asked.current) { asked.current = true; ask(); }
  }, []);
  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-5 bg-bg px-8 text-center" role="dialog" aria-modal="true" aria-label={t('Κλειδωμένο')}>
      <span className="flex size-20 items-center justify-center rounded-[1.75rem] bg-accent-soft text-4xl text-accent"><IconShield /></span>
      <div>
        <p className="text-xl font-extrabold">{t('Κλειδωμένο')}</p>
        <p className="mt-1.5 max-w-xs text-[15px] leading-relaxed text-ink-2">{t('Τα εγχειρίδια, οι εγγυήσεις και τα παραστατικά σου προστατεύονται με {label}.', { label })}</p>
      </div>
      <button type="button" className="btn btn-primary min-w-56" onClick={ask}>{t('Ξεκλείδωμα με {label}', { label })}</button>
    </div>
  );
}
