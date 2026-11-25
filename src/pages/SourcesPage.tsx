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
          <p>{t('Σελίδες του PDF ή φωτογραφίες. Χαρτί A5 80 g/m², διπλής όψης: ≈ 2,5 g ανά φύλλο.')}</p>
        </Block>
        <Block title="CO₂">
          <p>{t('≈ 1,07 kg CO₂e ανά kg χαρτιού γραφείου από παρθένα ύλη (0,97 t ανά short ton): όσο θα χρειαζόταν η εκτύπωση των ψηφιακών σελίδων.')}</p>
          <Src href={EPA_WARM}>U.S. EPA — WARM v16 (Δεκ. 2023), Exhibit 3-12</Src>
        </Block>
        <Block title={t('Δέντρα')}>
          <p>{t('≈ 24 δέντρα ανά short ton (907 kg) χαρτιού εκτύπωσης από παρθένα ύλη. Χονδρική εκτίμηση, κατά την ίδια την πηγή.')}</p>
          <Src href={CONSERVATREE}>Conservatree — Trees Into Paper</Src>
        </Block>
        <Block title={t('Αναγνώριση μάρκας')}>
          <p>{t('Οι μεγαλύτερες λέξεις του εξωφύλλου αναζητούνται στο Wikidata, μια ανοιχτή βάση με εταιρείες και μάρκες, μαζί με παραλλαγές για λάθη ανάγνωσης (π.χ. «OBLIGHT» → «Olight»). Στέλνονται μόνο λέξεις, ποτέ η φωτογραφία. Απενεργοποιείται από τις Ρυθμίσεις.')}</p>
          <Src href="https://www.wikidata.org/">Wikidata</Src>
        </Block>
        <Block title={t('Εύρεση του εγχειριδίου')}>
          <p>{t('Η αναζήτηση ανοίγει μέσα στην εφαρμογή. Όταν βρεις το εγχειρίδιο ή τη σελίδα του, πάτα Κοινοποίηση και «Αποθήκευση στο προϊόν»: η εφαρμογή το κατεβάζει απευθείας από τον ιστότοπο και το κρατά στη συσκευή. Αν αποθηκεύσεις σελίδα, σου δείχνει τα PDF της για να διαλέξεις. Η εφαρμογή δεν βλέπει τι άλλο κάνεις στην αναζήτηση — μόνο τη διεύθυνση που αποθηκεύεις.')}</p>
        </Block>
        <Block title={t('Σύνδεσμοι')}>
          <p>{t('Για τους συνδέσμους (π.χ. από τα QR του εντύπου) η εφαρμογή φέρνει τον τίτλο και το εικονίδιο: για βίντεο YouTube και Vimeo μέσω του ανοιχτού προτύπου oEmbed, για άλλες σελίδες από την ίδια τη σελίδα. Ο τίτλος που γράφεις εσύ δεν αλλάζει ποτέ.')}</p>
          <Src href="https://oembed.com/">oEmbed</Src>
        </Block>
        <Block title={t('Συμβουλές ανακύκλωσης')}>
          <Src href={sourceUrl('annex7', getLang())}>{t('Οδηγία 2012/19/ΕΕ (ΑΗΗΕ): άρθρο 14, Παραρτήματα VII και IX')}</Src>
          <Src href={sourceUrl('epa', getLang())}>U.S. EPA — Electronics Donation and Recycling</Src>
        </Block>
      </div>
    </div>
  );
}
