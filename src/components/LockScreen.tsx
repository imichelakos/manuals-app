/**
 * Οθόνη κλειδώματος: καλύπτει όλη την εφαρμογή μέχρι να πετύχει το Face ID. Ζητά Face ID μόλις η εφαρμογή είναι
 * ορατή (το κλείδωμα μπαίνει ήδη στο παρασκήνιο, όπου το Face ID δεν μπορεί να ζητηθεί) και ξανά σε κάθε επιστροφή.
 */
import { useEffect, useRef, useState } from 'react';
import { unlock } from '@/data/appLock';
import { useLatest } from '@/hooks/useLatest';
import { biometricInfo } from '@/services/deviceSecurity';
import { t } from '@/i18n';
import { IconShield } from './icons';

export function LockScreen() {
  const [label, setLabel] = useState('Face ID');
  const asking = useRef(false);
  const endedAt = useRef(0);
  const ask = () => {
    // όχι ξανά αμέσως μετά από ακύρωση: αν το παράθυρο του Face ID κρύβει για λίγο την εφαρμογή, θα γινόταν βρόχος
    if (asking.current || Date.now() - endedAt.current < 1500) return;
    asking.current = true;
    void unlock(t('Ξεκλείδωμα των εγχειριδίων σου')).finally(() => { asking.current = false; endedAt.current = Date.now(); });
  };
  const askLatest = useLatest(ask);
  useEffect(() => {
    void biometricInfo().then((i) => { if (i.label) setLabel(i.label); });
    const onVisible = () => { if (document.visibilityState === 'visible') askLatest.current(); };
    onVisible();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [askLatest]);
  return (
    <div className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-5 bg-bg px-8 text-center" role="dialog" aria-modal="true" aria-label={t('Κλειδωμένο')}>
      <span className="flex size-20 items-center justify-center rounded-[1.75rem] bg-accent-soft text-4xl text-accent"><IconShield /></span>
      <div>
        <p className="text-xl font-extrabold">{t('Κλειδωμένο')}</p>
        <p className="mt-1.5 max-w-xs text-[15px] leading-relaxed text-ink-2">{t('Τα εγχειρίδια, οι εγγυήσεις και τα παραστατικά σου προστατεύονται με {label}.', { label })}</p>
      </div>
      <button type="button" className="btn btn-primary min-w-56" onClick={() => { endedAt.current = 0; ask(); }}>{t('Ξεκλείδωμα με {label}', { label })}</button>
    </div>
  );
}
