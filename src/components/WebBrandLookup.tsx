/**
 * Οθόνη «Τι βρήκαμε» → μάρκα από το διαδίκτυο (Wikidata), όταν το κείμενο δεν έδωσε μάρκα. Την πρώτη φορά ρωτά τον
 * χρήστη και εξηγεί τι στέλνεται (μόνο λέξεις, όχι η εικόνα)· η απάντηση αλλάζει από τις Ρυθμίσεις.
 */
import { useEffect, useState } from 'react';
import { setSettings, useSettings } from '@/data/settings';
import { lookupBrand, type BrandMatch } from '@/services/wikidata';
import { t } from '@/i18n';

export function WebBrandLookup({ candidates, onFound }: { candidates: string[]; onFound: (m: BrandMatch) => void }) {
  const { webBrand } = useSettings();
  // undefined: η αναζήτηση δεν έχει τελειώσει · null: δεν βρέθηκε · αλλιώς η μάρκα
  const [result, setResult] = useState<BrandMatch | null | undefined>(undefined);
  const active = webBrand === true && candidates.length > 0;

  useEffect(() => {
    if (!active) return;
    let alive = true;
    void lookupBrand(candidates).then((m) => {
      if (!alive) return;
      setResult(m);
      if (m) onFound(m);
    });
    return () => { alive = false; };
  }, [active, candidates, onFound]);

  if (!candidates.length || webBrand === false) return null;
  if (webBrand === null) {
    return (
      <div className="mt-2 rounded-2xl bg-accent-soft p-3.5 text-[13px] leading-snug">
        <p className="font-semibold text-accent">{t('Να βρίσκω τη μάρκα στο διαδίκτυο;')}</p>
        <p className="mt-1 text-ink-2">{t('Λέξεις του εξωφύλλου (εδώ: {w}) αναζητούνται στο Wikidata, μια ανοιχτή βάση με εταιρείες και μάρκες. Στέλνονται μόνο αυτές οι λέξεις — όχι η φωτογραφία. Δωρεάν. Μπορείς να το αλλάξεις στις Ρυθμίσεις.', { w: candidates.join(', ') })}</p>
        <div className="mt-2.5 flex gap-2">
          <button type="button" className="btn btn-plain min-h-10 flex-1 bg-surface text-ink" onClick={() => setSettings({ webBrand: false })}>{t('Όχι')}</button>
          <button type="button" className="btn btn-primary min-h-10 flex-1" onClick={() => setSettings({ webBrand: true })}>{t('Ναι')}</button>
        </div>
      </div>
    );
  }
  if (result === undefined) return <p className="mt-2 text-[13px] text-ink-3" role="status">{t('Αναζήτηση της μάρκας στο Wikidata…')}</p>;
  if (result) return <p className="mt-2 text-[13px] text-ink-2">{t('Από το Wikidata: {b} — {d}', { b: result.brand, d: result.description })}</p>;
  return <p className="mt-2 text-[13px] text-ink-3">{t('Δεν βρέθηκε μάρκα στο Wikidata. Συμπλήρωσέ τη εσύ.')}</p>;
}
