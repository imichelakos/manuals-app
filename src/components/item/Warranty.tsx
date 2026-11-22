/** Αγορά και εγγύηση: ημερομηνία αγοράς + διάρκεια → λήξη (ή ρητή λήξη), κατάστημα, τιμή, σημείωση. */
import type { Item } from '@/domain/model';
import { warrantyInfo } from '@/domain/warranty';
import { today } from '@/domain/dates';
import { updateItem } from '@/data/library';
import { useSettings } from '@/data/settings';
import { t } from '@/i18n';
import { AutoField } from '@/components/controls';
import { warrantyText } from '@/components/WarrantyBadge';
import { IconShield } from '@/components/icons';

const MONTHS = [12, 24, 36, 60];

export function WarrantySection({ item }: { item: Item }) {
  const { warrantyMonths } = useSettings();
  const w = warrantyInfo(item, today());
  const patch = (fn: (c: Item) => Item) => void updateItem(item.id, fn);
  const tone = w.state === 'active' ? 'bg-ok-soft text-ok' : w.state === 'expiring' ? 'bg-warn-soft text-warn' : w.state === 'expired' ? 'bg-bad-soft text-bad' : 'bg-surface-2 text-ink-2';
  const months = item.warranty.months;
  const label = (m: number) => (m % 12 === 0 ? (m === 12 ? t('1 χρόνος') : t('{n} χρόνια', { n: m / 12 })) : t('{n} μήνες', { n: m }));
  const options = [...new Set([...MONTHS, warrantyMonths, ...(months ? [months] : [])])].filter((m) => m > 0).sort((a, b) => a - b);

  return (
    <section className="card p-5">
      <h2 className="section-title">{t('Αγορά και εγγύηση')}</h2>
      <div className={`mt-3 flex items-center gap-3 rounded-2xl p-3.5 ${tone}`}>
        <IconShield className="shrink-0 text-2xl" />
        <p className="text-[15px] font-bold">{w.state === 'none' ? t('Βάλε ημερομηνία αγοράς και διάρκεια για να βλέπεις πότε λήγει') : warrantyText(w)}</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="w-date">{t('Ημερομηνία αγοράς')}</label>
          <input id="w-date" type="date" className="input" max={today()} value={item.purchase.date ?? ''}
            onChange={(e) => patch((c) => ({ ...c, purchase: { ...c.purchase, date: e.target.value || undefined } }))} />
        </div>
        <div>
          <label className="label" htmlFor="w-until">{t('Λήξη (αν διαφέρει)')}</label>
          <input id="w-until" type="date" className="input" value={item.warranty.until ?? ''}
            onChange={(e) => patch((c) => ({ ...c, warranty: { ...c.warranty, until: e.target.value || undefined } }))} />
        </div>
      </div>

      <fieldset className="mt-3">
        <legend className="label">{t('Διάρκεια εγγύησης')}</legend>
        <div className="flex flex-wrap gap-2">
          {options.map((m) => (
            <button key={m} type="button" aria-pressed={months === m} className={`chip ${months === m ? 'chip-on' : ''}`}
              onClick={() => patch((c) => ({ ...c, warranty: { ...c.warranty, months: months === m ? undefined : m } }))}>{label(m)}</button>
          ))}
          <label className="chip gap-2 pr-2">
            <span>{t('Άλλη')}</span>
            <input type="number" inputMode="numeric" min={1} max={600} className="w-[4.5rem] rounded-lg bg-surface-2 px-2 py-1 text-center text-base text-ink outline-hidden"
              aria-label={t('Διάρκεια εγγύησης σε μήνες')} placeholder={t('μήνες')} value={months && !options.includes(months) ? months : ''}
              onChange={(e) => { const n = Math.round(Number(e.target.value)); patch((c) => ({ ...c, warranty: { ...c.warranty, months: n >= 1 && n <= 600 ? n : undefined } })); }} />
          </label>
        </div>
      </fieldset>

      <div className="mt-3 grid grid-cols-[1fr_7.5rem] gap-3">
        <div>
          <label className="label" htmlFor="w-store">{t('Κατάστημα')}</label>
          <AutoField id="w-store" value={item.purchase.store ?? ''} onCommit={(v) => patch((c) => ({ ...c, purchase: { ...c.purchase, store: v.trim() || undefined } }))} />
        </div>
        <div>
          <label className="label" htmlFor="w-price">{t('Τιμή (€)')}</label>
          <AutoField id="w-price" inputMode="decimal" value={item.purchase.price?.toString().replace('.', ',') ?? ''}
            onCommit={(v) => { const n = Number(v.replace(',', '.').replace(/[^\d.]/g, '')); patch((c) => ({ ...c, purchase: { ...c.purchase, price: v.trim() && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : undefined } })); }} />
        </div>
      </div>
      <div className="mt-3">
        <label className="label" htmlFor="w-note">{t('Σημείωση εγγύησης')}</label>
        <AutoField id="w-note" value={item.warranty.note ?? ''} placeholder={t('π.χ. επέκταση 5 ετών στον συμπιεστή')} onCommit={(v) => patch((c) => ({ ...c, warranty: { ...c.warranty, note: v.trim() || undefined } }))} />
      </div>
    </section>
  );
}
