/**
 * Οθόνη «Τι βρήκαμε» → μάρκα από το διαδίκτυο (Wikidata), όταν το κείμενο δεν έδωσε μάρκα. Ενεργή από προεπιλογή
 * (απόφαση 23/11/2026: στην πολιτική απορρήτου, χωρίς ερώτηση)· κλείνει από τις Ρυθμίσεις. Πώς λειτουργεί: σελίδα
 * «Πηγές και υπολογισμοί». Εδώ φαίνεται μόνο ότι γίνεται αναζήτηση.
 */
import { useEffect, useState } from 'react';
import { useSettings } from '@/data/settings';
import { lookupBrand, type BrandMatch } from '@/services/wikidata';
import { t } from '@/i18n';

export function WebBrandLookup({ candidates, onFound }: { candidates: string[]; onFound: (m: BrandMatch) => void }) {
  const { webBrand } = useSettings();
  const active = webBrand && candidates.length > 0;
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    void lookupBrand(candidates).then((m) => {
      if (!alive) return;
      setDone(true);
      if (m) onFound(m);
    });
    return () => { alive = false; };
  }, [active, candidates, onFound]);

  if (!active || done) return null;
  return <p className="mt-2 text-[13px] text-ink-3" role="status">{t('Αναζήτηση της μάρκας…')}</p>;
}
