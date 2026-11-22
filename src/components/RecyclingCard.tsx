/** Βιβλιοθήκη → κάρτα ανακύκλωσης: μπάρα προόδου και τρία πλήθη· κάθε πλήθος είναι και γρήγορο φίλτρο. */
import type { RecyclingStats } from '@/domain/recycling';
import { locale, t, tn } from '@/i18n';
import { IconRecycle } from './icons';

/** 840 → «840 g», 1250 → «1,3 kg» */
const grams = (g: number) => (g < 1000 ? `${Math.round(g).toLocaleString(locale())} g` : `${(g / 1000).toLocaleString(locale(), { maximumFractionDigits: 1 })} kg`);

export type RecyclingFilter = 'recycled' | 'ready' | 'waiting';

export function RecyclingCard({ stats: s, active, onPick }: { stats: RecyclingStats; active: RecyclingFilter | null; onPick: (f: RecyclingFilter) => void }) {
  if (!s.total) return null;
  const w = (n: number) => `${(n / s.total) * 100}%`;
  const rows: { key: RecyclingFilter; n: number; label: string; dot: string }[] = [
    { key: 'recycled', n: s.recycled, label: t('ανακυκλώθηκαν'), dot: 'bg-ok' },
    { key: 'ready', n: s.ready, label: t('έτοιμα'), dot: 'bg-ok/40' },
    { key: 'waiting', n: s.waiting, label: t('χωρίς ψηφιακό'), dot: 'bg-ink-3/40' },
  ];
  return (
    <section className="card mb-3 p-4" aria-label={t('Ανακύκλωση')}>
      <div className="flex items-center gap-2.5">
        <IconRecycle className="text-xl text-ok" />
        <p className="text-[15px] font-bold">{tn(s.recycled, '{n} έντυπο ανακυκλώθηκε', '{n} έντυπα ανακυκλώθηκαν')}</p>
        <span className="ml-auto text-sm font-semibold text-ink-2">{s.recycledPct}%</span>
      </div>
      <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-surface-2" role="img"
        aria-label={t('{a} ανακυκλώθηκαν, {b} έτοιμα, {c} χωρίς ψηφιακό', { a: s.recycled, b: s.ready, c: s.waiting })}>
        <span className="bg-ok" style={{ width: w(s.recycled) }} />
        <span className="bg-ok/40" style={{ width: w(s.ready) }} />
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {rows.map((r) => (
          <button key={r.key} type="button" aria-pressed={active === r.key} disabled={!r.n && active !== r.key} onClick={() => onPick(r.key)}
            className={`flex min-h-9 items-center gap-1.5 rounded-full px-3 text-[13px] transition disabled:opacity-40 ${active === r.key ? 'bg-ink text-bg' : 'bg-surface-2 text-ink-2'}`}>
            <span className={`size-2 rounded-full ${r.dot}`} aria-hidden="true" /><span className="font-bold">{r.n}</span> {r.label}
          </button>
        ))}
      </div>
      {s.pagesDigital > 0 && <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-surface-2 px-3 py-2.5">
          <p className="text-lg font-extrabold leading-tight">{s.pagesDigital.toLocaleString(locale())}</p>
          <p className="text-[12px] leading-snug text-ink-2">{t('σελίδες σε ψηφιακή μορφή')}</p>
        </div>
        <div className="rounded-2xl bg-surface-2 px-3 py-2.5">
          <p className="text-lg font-extrabold leading-tight">≈ {grams(s.paperGrams)}</p>
          <p className="text-[12px] leading-snug text-ink-2">{t('χαρτί ανακυκλώθηκε (εκτίμηση)')}</p>
        </div>
      </div>}
      <details className="mt-2 text-[12px] leading-relaxed text-ink-3">
        <summary className="cursor-pointer font-semibold">{t('Πώς υπολογίζεται')}</summary>
        <p className="mt-1">{t('Σελίδες: του PDF κάθε εγχειριδίου, ή όσες σελίδες φωτογράφισες. Βάρος: υποθέτουμε ότι το έντυπο είχε όσες σελίδες και το PDF, τυπωμένες και στις δύο όψεις σε χαρτί A5 80 g/m² (≈ 2,5 g το φύλλο).')}</p>
        {s.paperUnknown > 0 && <p className="mt-1">{tn(s.paperUnknown, '{n} ανακυκλωμένο έντυπο δεν μετρά: δεν ξέρουμε τις σελίδες του.', '{n} ανακυκλωμένα έντυπα δεν μετρούν: δεν ξέρουμε τις σελίδες τους.')}</p>}
        <p className="mt-1">{t('Ψηφιακό εγχειρίδιο: {p}% των προϊόντων', { p: s.digitalPct })}</p>
      </details>
    </section>
  );
}
