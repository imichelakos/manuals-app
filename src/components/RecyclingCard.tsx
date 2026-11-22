/** Βιβλιοθήκη → κάρτα ανακύκλωσης: μπάρα προόδου και τρία πλήθη· κάθε πλήθος είναι και γρήγορο φίλτρο. */
import type { RecyclingStats } from '@/domain/recycling';
import { t, tn } from '@/i18n';
import { IconRecycle } from './icons';

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
      <p className="mt-2 text-[12px] text-ink-3">{t('Ψηφιακό εγχειρίδιο: {p}% των προϊόντων', { p: s.digitalPct })}</p>
    </section>
  );
}
