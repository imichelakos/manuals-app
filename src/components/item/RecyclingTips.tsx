/**
 * «Όταν δεν θα τη χρειάζεσαι»: γενικές συμβουλές ανακύκλωσης της ίδιας της συσκευής (domain/recyclingTips).
 * Κλειστό από προεπιλογή: είναι χρήσιμο στο τέλος της ζωής του προϊόντος, όχι κάθε φορά που ανοίγει η καρτέλα.
 */
import type { Item } from '@/domain/model';
import { groupOf } from '@/domain/groups';
import { recyclingTips, sourceUrl, type SourceId, type TipId } from '@/domain/recyclingTips';
import { getLang, t } from '@/i18n';
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
  takeBack: t('Πολλοί κατασκευαστές και καταστήματα έχουν προγράμματα επιστροφής· αλλιώς ψάξε πιστοποιημένο ανακυκλωτή ηλεκτρονικών στην περιοχή σου.'),
  unpowered: t('Δεν είναι ηλεκτρική συσκευή: για ογκώδη αντικείμενα ρώτα τον δήμο σου, ή δώσ’ το για να ξαναχρησιμοποιηθεί.'),
})[id];

const sourceLabel = (id: SourceId): string => ({
  annex7: t('Οδηγία 2012/19/ΕΕ, Παράρτημα VII'),
  annex9: t('Οδηγία 2012/19/ΕΕ, άρθρο 14 και Παράρτημα IX'),
  epa: 'U.S. EPA',
})[id];

export function RecyclingTipsSection({ item }: { item: Item }) {
  const tips = recyclingTips({ name: item.name, group: groupOf(item) });
  return (
    <details className="card group p-5">
      <summary className="flex cursor-pointer list-none items-center gap-2.5">
        <IconRecycle className="text-xl text-ok" />
        <h2 className="section-title flex-1">{t('Όταν δεν θα τη χρειάζεσαι')}</h2>
        <span className="text-sm text-ink-3 group-open:hidden">{t('Συμβουλές')}</span>
      </summary>
      <ul className="mt-4 space-y-2.5">
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
