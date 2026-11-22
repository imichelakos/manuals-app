/**
 * «Όταν δεν θα τη χρειάζεσαι»: συμβουλές ανακύκλωσης της ίδιας της συσκευής (domain/recyclingTips), ανά περιοχή.
 * Κλειστό από προεπιλογή: είναι χρήσιμο στο τέλος της ζωής του προϊόντος, όχι κάθε φορά που ανοίγει η καρτέλα.
 */
import type { Item } from '@/domain/model';
import { groupOf } from '@/domain/groups';
import { recyclingTips, regionFromLocales, sourceUrl, type RecyclingRegion, type SourceId, type TipId } from '@/domain/recyclingTips';
import { setSettings, useSettings } from '@/data/settings';
import { getLang, t, userLanguages } from '@/i18n';
import { ExternalLink } from '@/components/ExternalLink';
import { IconRecycle } from '@/components/icons';

const text = (id: TipId): string => ({
  reuse: t('Αν λειτουργεί ακόμη, σκέψου επισκευή ή δωρεά πριν την ανακύκλωση.'),
  symbol: t('Μην την πετάξεις στα κοινά σκουπίδια: ο διαγραμμένος κάδος με ρόδες πάνω στη συσκευή σημαίνει χωριστή συλλογή.'),
  cooling: t('Οι συσκευές ψύξης έχουν ψυκτικά αέρια (π.χ. HFC ή υδρογονάνθρακες) που αφαιρούνται υποχρεωτικά κατά την επεξεργασία. Παράδωσέ τη ολόκληρη σε σημείο συλλογής και μην ανοίξεις το κύκλωμα ψύξης.'),
  lamps: t('Λαμπτήρες εκκένωσης αερίου (π.χ. φθορισμού) και εξαρτήματα με υδράργυρο αφαιρούνται χωριστά κατά την επεξεργασία: οι λαμπτήρες πάνε σε σημείο συλλογής, όχι στα σκουπίδια.'),
  data: t('Πριν τη δώσεις, σβήσε όλα τα προσωπικά δεδομένα (π.χ. επαναφορά εργοστασιακών ρυθμίσεων).'),
  batteries: t('Βγάλε τις μπαταρίες, αν αφαιρούνται: ανακυκλώνονται χωριστά.'),
  lithium: t('Μπαταρίες λιθίου, και συσκευές που τις έχουν, δεν πάνε στα οικιακά σκουπίδια ούτε στον κάδο ανακύκλωσης.'),
  oneToOne: t('Αγοράζεις καινούργια ίδιου τύπου; Το κατάστημα κατά κανόνα παραλαμβάνει δωρεάν την παλιά («ένα προς ένα»).'),
  smallZeroToOne: t('Μικρές συσκευές (καμία διάσταση πάνω από 25 cm) κατά κανόνα παραδίδονται δωρεάν σε καταστήματα ηλεκτρικών με χώρο πώλησης τουλάχιστον 400 m², χωρίς υποχρέωση αγοράς.'),
  grPoints: t('Βρες το κοντινότερο σημείο ανακύκλωσης συσκευών και λαμπτήρων στον χάρτη της Ανακύκλωσης Συσκευών Α.Ε.'),
  grBatteries: t('Οι μπαταρίες πάνε στους κάδους της ΑΦΗΣ.'),
  worldTakeBack: t('Πολλοί κατασκευαστές και καταστήματα έχουν προγράμματα επιστροφής· αλλιώς ψάξε πιστοποιημένο ανακυκλωτή ηλεκτρονικών στην περιοχή σου.'),
  unpowered: t('Δεν είναι ηλεκτρική συσκευή: για ογκώδη αντικείμενα ρώτα τον δήμο σου, ή δώσ’ το για να ξαναχρησιμοποιηθεί.'),
})[id];

const sourceLabel = (id: SourceId): string => ({
  art5: t('Οδηγία 2012/19/ΕΕ, άρθρο 5 §2'),
  annex7: t('Οδηγία 2012/19/ΕΕ, Παράρτημα VII'),
  annex9: t('Οδηγία 2012/19/ΕΕ, άρθρο 14 και Παράρτημα IX'),
  electrocycle: t('Ανακύκλωση Συσκευών Α.Ε.'),
  afis: t('ΑΦΗΣ'),
  epa: 'U.S. EPA',
})[id];

export function RecyclingTipsSection({ item }: { item: Item }) {
  const { recyclingRegion } = useSettings();
  const region: RecyclingRegion = recyclingRegion === 'auto' ? regionFromLocales(userLanguages()) : recyclingRegion;
  const tips = recyclingTips({ name: item.name, category: item.category, group: groupOf(item) }, region);
  const regions: [RecyclingRegion, string][] = [['gr', t('Ελλάδα')], ['eu', t('ΕΕ')], ['world', t('Άλλη χώρα')]];
  return (
    <details className="card group p-5">
      <summary className="flex cursor-pointer list-none items-center gap-2.5">
        <IconRecycle className="text-xl text-ok" />
        <h2 className="section-title flex-1">{t('Όταν δεν θα τη χρειάζεσαι')}</h2>
        <span className="text-sm text-ink-3 group-open:hidden">{t('Συμβουλές')}</span>
      </summary>
      <div role="radiogroup" aria-label={t('Περιοχή')} className="mt-4 inline-flex gap-1 rounded-2xl bg-surface-2 p-1">
        {regions.map(([r, label]) => (
          <button key={r} type="button" role="radio" aria-checked={region === r} onClick={() => setSettings({ recyclingRegion: r })}
            className={`min-h-9 rounded-xl px-3 text-sm font-semibold transition ${region === r ? 'bg-surface text-ink shadow-card' : 'text-ink-2'}`}>{label}</button>
        ))}
      </div>
      <ul className="mt-3 space-y-2.5">
        {tips.map((tip) => (
          <li key={tip.id} className="rounded-2xl bg-surface-2 p-3.5 text-[15px] leading-relaxed">
            {text(tip.id)}
            {tip.source && <ExternalLink href={sourceUrl(tip.source, getLang())} className="mt-1 block text-[12px] font-semibold text-accent">{t('Πηγή: {s}', { s: sourceLabel(tip.source) })}</ExternalLink>}
          </li>
        ))}
      </ul>
    </details>
  );
}
