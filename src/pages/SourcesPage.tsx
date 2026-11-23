/**
 * «Πηγές και υπολογισμοί»: πώς βγαίνουν οι εκτιμήσεις της εφαρμογής (σελίδες, χαρτί, CO2, δέντρα) και από πού
 * προέρχονται οι συμβουλές ανακύκλωσης. Μία θέση για όλες τις πηγές (απόφαση 23/11/2026).
 */
import { useNavigate } from 'react-router';
import { getLang, t } from '@/i18n';
import { sourceUrl } from '@/domain/recyclingTips';
import { ExternalLink } from '@/components/ExternalLink';
import { IconBack } from '@/components/icons';

const EPA_WARM = 'https://www.epa.gov/system/files/documents/2023-12/warm_containers_packaging_and_non-durable_goods_materials_v16_dec.pdf';
const CONSERVATREE = 'http://conservatree.org/learn/EnviroIssues/TreeStats.shtml';

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="text-[16px] font-bold">{title}</h2>
      <div className="mt-2 space-y-2 text-[14px] leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

const Src = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <ExternalLink href={href} className="block text-[13px] font-semibold text-accent">{children}</ExternalLink>
);

export default function SourcesPage() {
  const nav = useNavigate();
  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-[calc(0.75rem+env(safe-area-inset-top))]">
      <div className="flex items-center gap-1 pb-3">
        <button type="button" className="icon-btn -ml-2" onClick={() => nav(-1)} aria-label={t('Πίσω')}><IconBack className="text-2xl" /></button>
        <h1 className="text-xl font-extrabold">{t('Πηγές και υπολογισμοί')}</h1>
      </div>
      <div className="flex flex-col gap-4">
        <Block title={t('Σελίδες και χαρτί')}>
          <p>{t('Σελίδες: του PDF κάθε εγχειριδίου, ή όσες σελίδες φωτογράφισες.')}</p>
          <p>{t('Χαρτί: υποθέτουμε εκτύπωση και στις δύο όψεις σε χαρτί A5 80 g/m², δηλαδή ≈ 2,5 g ανά φύλλο (0,148 × 0,210 m × 80 g/m²). Για τα ανακυκλωμένα έντυπα υποθέτουμε όσες σελίδες έχει και το PDF.')}</p>
        </Block>
        <Block title={t('CO₂ (εκτίμηση)')}>
          <p>{t('Όσο CO₂ θα χρειαζόταν για να παραχθεί το χαρτί των σελίδων σου σε ψηφιακή μορφή: ≈ 1,07 kg CO₂e ανά kg χαρτιού. Ισχύει αν το έντυπο δεν τυπωνόταν· αν ήρθε τυπωμένο, το CO₂ αυτό έχει ήδη εκλυθεί.')}</p>
          <p>{t('Από τον συντελεστή 0,97 t CO₂e ανά short ton χαρτιού γραφείου από παρθένα ύλη, με 1 μετρικό τόνο = 0,907 short tons. Δεν περιλαμβάνει τον άνθρακα που αποθηκεύεται στο δάσος.')}</p>
          <Src href={EPA_WARM}>U.S. EPA — WARM v16 (Δεκ. 2023), Exhibit 3-12</Src>
        </Block>
        <Block title={t('Δέντρα (χονδρική εκτίμηση)')}>
          <p>{t('24 δέντρα ανά αμερικανικό τόνο (907 kg) χαρτιού εκτύπωσης από παρθένα ύλη. Η ίδια η πηγή το χαρακτηρίζει χονδρική εκτίμηση: βασίζεται σε υπολογισμό για μείγμα δέντρων ύψους ≈ 12 m, που δημοσιεύτηκε σε βιβλίο του 1992. Δεν βρήκαμε επιστημονική πρωτογενή πηγή.')}</p>
          <Src href={CONSERVATREE}>Conservatree — How many trees make a ton of paper?</Src>
        </Block>
        <Block title={t('Συμβουλές ανακύκλωσης')}>
          <p>{t('Οι συμβουλές για το τέλος ζωής μιας συσκευής βασίζονται σε:')}</p>
          <Src href={sourceUrl('annex7', getLang())}>{t('Οδηγία 2012/19/ΕΕ (ΑΗΗΕ): άρθρο 14, Παραρτήματα VII και IX')}</Src>
          <Src href={sourceUrl('epa', getLang())}>U.S. EPA — Electronics Donation and Recycling</Src>
        </Block>
      </div>
    </div>
  );
}
