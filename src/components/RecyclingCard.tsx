/** Βιβλιοθήκη → κάρτα ανακύκλωσης: μπάρα προόδου και τρία πλήθη· κάθε πλήθος είναι και γρήγορο φίλτρο. */
import type { RecyclingStats } from '@/domain/recycling';
import { Link } from 'react-router';
import { locale, t, tn } from '@/i18n';
import { IconRecycle } from './icons';

/** 840 → «840 g», 1250 → «1,3 kg» */
const grams = (g: number) => (g < 1000 ? `${Math.round(g).toLocaleString(locale())} g` : `${(g / 1000).toLocaleString(locale(), { maximumFractionDigits: 1 })} kg`);

/** 0,55 → «0,55 kg», 12,3 → «12 kg» */
const kg = (v: number) => `${v.toLocaleString(locale(), { maximumFractionDigits: v < 10 ? 2 : 0 })} kg`;
/** κάτω από ένα δέντρο ως κλάσμα («1/70 δέντρου»), αλλιώς με ένα δεκαδικό */
const treesText = (n: number) => (n < 1 ? t('1/{d} δέντρου', { d: Math.max(1, Math.round(1 / n)).toLocaleString(locale()) }) : n < 1.05 ? t('1 δέντρο') : t('{n} δέντρα', { n: (Math.round(n * 10) / 10).toLocaleString(locale()) }));

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
      {s.pagesDigital > 0 && <>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-surface-2 px-3 py-2.5">
            <p className="text-lg font-extrabold leading-tight">{s.pagesDigital.toLocaleString(locale())}</p>
            <p className="text-[12px] leading-snug text-ink-2">{t('σελίδες σε ψηφιακή μορφή')}</p>
          </div>
          <div className="rounded-2xl bg-ok-soft px-3 py-2.5 text-ok">
            <p className="text-lg font-extrabold leading-tight">≈ {kg(s.co2Kg)} CO₂</p>
            <p className="text-[12px] leading-snug">{t('θα χρειαζόταν για εκτύπωση (εκτίμηση)')}</p>
            <p className="mt-0.5 text-[12px] font-semibold leading-snug">≈ {treesText(s.trees)}</p>
          </div>
        </div>
        <p className="mt-2 text-[13px] text-ink-2">{t('≈ {w} χαρτί ανακυκλώθηκε (εκτίμηση)', { w: grams(s.paperGrams) })}</p>
        {s.paperUnknown > 0 && <p className="mt-0.5 text-[12px] text-ink-3">{tn(s.paperUnknown, '{n} ανακυκλωμένο έντυπο δεν μετρά: δεν ξέρουμε τις σελίδες του.', '{n} ανακυκλωμένα έντυπα δεν μετρούν: δεν ξέρουμε τις σελίδες τους.')}</p>}
      </>}
      <Link to="/sources" className="mt-2 inline-block text-[13px] font-semibold text-accent">{t('Πώς υπολογίζεται ›')}</Link>
    </section>
  );
}
