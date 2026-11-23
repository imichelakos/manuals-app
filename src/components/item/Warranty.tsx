/**
 * Αγορά και εγγύηση: ημερομηνία αγοράς + διάρκεια (μήνες ή χρόνια) → λήξη· προαιρετικά συγκεκριμένη ημερομηνία λήξης
 * που υπερισχύει (π.χ. όταν η εγγύηση μετρά από την παράδοση/εγκατάσταση). Κατάστημα, τιμή, σημείωση.
 */
import { useState } from 'react';
import type { Item } from '@/domain/model';
import { warrantyInfo } from '@/domain/warranty';
import { today } from '@/domain/dates';
import { updateItem } from '@/data/library';
import { setSettings, useSettings } from '@/data/settings';
import { COMMON_CURRENCIES, currencyOf } from '@/domain/currency';
import { t, tn } from '@/i18n';
import { AutoField, OtherNumber } from '@/components/controls';
import { warrantyText } from '@/components/WarrantyBadge';
import { IconClose, IconShield } from '@/components/icons';

const MONTHS = [12, 24, 36, 60];

export function WarrantySection({ item }: { item: Item }) {
  const { warrantyMonths, currency: lastCurrency } = useSettings();
  const w = warrantyInfo(item, today());
  const patch = (fn: (c: Item) => Item) => void updateItem(item.id, fn);
  const tone = w.state === 'active' ? 'bg-ok-soft text-ok' : w.state === 'expiring' ? 'bg-warn-soft text-warn' : w.state === 'expired' ? 'bg-bad-soft text-bad' : 'bg-surface-2 text-ink-2';
  const months = item.warranty.months;
  // νόμισμα: της τιμής που υπάρχει ήδη· χωρίς τιμή, το τελευταίο που χρησιμοποίησε ο χρήστης
  const currency = item.purchase.price !== undefined || item.purchase.currency ? currencyOf(item.purchase) : lastCurrency;
  const currencies = [...new Set([currency, ...COMMON_CURRENCIES])];
  const label = (m: number) => (m % 12 === 0 ? (m === 12 ? t('1 χρόνος') : t('{n} χρόνια', { n: m / 12 })) : tn(m, '{n} μήνας', '{n} μήνες'));
  // chips: οι συνηθισμένες + η προεπιλογή των Ρυθμίσεων + η διάρκεια του προϊόντος (μια «Άλλη» γίνεται chip μόλις αποθηκευτεί)
  const options = [...new Set([...MONTHS, warrantyMonths, ...(months ? [months] : [])])].filter((m) => m > 0).sort((a, b) => a - b);
  const setMonths = (n: number | undefined) => patch((c) => ({ ...c, warranty: { ...c.warranty, months: n } }));
  // «Άλλη» διάρκεια: σε χρόνια (8 → 96 μήνες) ή σε μήνες· αποθηκεύεται πάντα σε μήνες
  const [unit, setUnit] = useState<'years' | 'months'>('years');
  // συγκεκριμένη ημερομηνία λήξης: κρυμμένη μέχρι να τη ζητήσει ο χρήστης (ή αν έχει ήδη τιμή)
  const [untilOpen, setUntilOpen] = useState(false);
  const showUntil = untilOpen || !!item.warranty.until;
  const setUntil = (v: string | undefined) => patch((c) => ({ ...c, warranty: { ...c.warranty, until: v || undefined } }));

  return (
    <section className="card p-5">
      <h2 className="section-title">{t('Αγορά και εγγύηση')}</h2>
      <div className={`mt-3 flex items-center gap-3 rounded-2xl p-3.5 ${tone}`}>
        <IconShield className="shrink-0 text-2xl" />
        <p className="text-[15px] font-bold">{w.state === 'none' ? t('Βάλε ημερομηνία αγοράς και διάρκεια για να βλέπεις πότε λήγει') : warrantyText(w)}</p>
      </div>

      <div className="mt-4">
        <label className="label" htmlFor="w-date">{t('Ημερομηνία αγοράς')}</label>
        <input id="w-date" type="date" className="input" max={today()} value={item.purchase.date ?? ''}
          onChange={(e) => patch((c) => ({ ...c, purchase: { ...c.purchase, date: e.target.value || undefined } }))} />
      </div>

      <fieldset className="mt-3">
        <legend className="label">{t('Διάρκεια εγγύησης')}</legend>
        {/* με επιλεγμένη διάρκεια μένει μόνο αυτή· νέο πάτημα την καταργεί και ξαναφέρνει τις επιλογές */}
        <div className="flex flex-wrap gap-2">
          {(months ? [months] : options).map((m) => (
            <button key={m} type="button" aria-pressed={months === m} className={`chip ${months === m ? 'chip-on' : ''}`}
              aria-label={months === m ? t('{d} — πάτησε για αλλαγή', { d: label(m) }) : undefined}
              onClick={() => setMonths(months === m ? undefined : m)}>{label(m)}{months === m && <IconClose className="text-sm opacity-70" />}</button>
          ))}
          {!months && <label className="chip gap-2 pr-2">
            <span>{t('Άλλη')}</span>
            <OtherNumber value={undefined} presets={options} min={1} max={unit === 'years' ? 50 : 600}
              onChange={(n) => { if (n) setMonths(unit === 'years' ? n * 12 : n); }}
              className="w-[3.75rem] rounded-lg bg-surface-2 px-2 py-1 text-center text-base text-ink outline-hidden"
              label={unit === 'years' ? t('Διάρκεια εγγύησης σε χρόνια') : t('Διάρκεια εγγύησης σε μήνες')} placeholder="—" />
            <select aria-label={t('Μονάδα')} value={unit} onChange={(e) => setUnit(e.target.value as 'years' | 'months')}
              className="rounded-lg bg-surface-2 py-1 pl-2 pr-1 text-sm text-ink outline-hidden">
              <option value="years">{t('χρόνια')}</option>
              <option value="months">{t('μήνες')}</option>
            </select>
          </label>}
        </div>
      </fieldset>

      {showUntil ? (
        <div className="mt-3 rounded-2xl bg-surface-2 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <label className="label mb-0" htmlFor="w-until">{t('Συγκεκριμένη ημερομηνία λήξης')}</label>
            <button type="button" className="icon-btn size-8" aria-label={t('Κατάργηση ημερομηνίας λήξης')} onClick={() => { setUntil(undefined); setUntilOpen(false); }}><IconClose className="text-base" /></button>
          </div>
          <input id="w-until" type="date" className="input mt-1.5" value={item.warranty.until ?? ''} onChange={(e) => setUntil(e.target.value)} />
          <p className="mt-1.5 text-[13px] leading-snug text-ink-2">{t('Υπερισχύει της «αγορά + διάρκεια». Για εγγύηση που μετρά από την παράδοση ή την εγκατάσταση, ή για επέκταση εγγύησης.')}</p>
        </div>
      ) : (
        <button type="button" className="mt-3 text-[14px] font-semibold text-accent" onClick={() => setUntilOpen(true)}>
          {t('Λήγει σε άλλη ημερομηνία;')}
        </button>
      )}

      <div className="mt-3 grid grid-cols-[1fr_10.5rem] gap-3">
        <div>
          <label className="label" htmlFor="w-store">{t('Κατάστημα')}</label>
          <AutoField id="w-store" value={item.purchase.store ?? ''} onCommit={(v) => patch((c) => ({ ...c, purchase: { ...c.purchase, store: v.trim() || undefined } }))} />
        </div>
        <div>
          <label className="label" htmlFor="w-price">{t('Τιμή')}</label>
          <div className="flex gap-1.5">
            <AutoField id="w-price" inputMode="decimal" className="input min-w-0" value={item.purchase.price?.toString().replace('.', ',') ?? ''}
              onCommit={(v) => { const n = Number(v.replace(',', '.').replace(/[^\d.]/g, '')); const price = v.trim() && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : undefined; patch((c) => ({ ...c, purchase: { ...c.purchase, price, currency: price === undefined ? undefined : currency } })); }} />
            <select aria-label={t('Νόμισμα')} className="input w-[4.75rem] shrink-0 px-2" value={currency}
              onChange={(e) => { const cur = e.target.value; setSettings({ currency: cur }); patch((c) => ({ ...c, purchase: { ...c.purchase, currency: c.purchase.price !== undefined ? cur : undefined } })); }}>
              {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>
      <div className="mt-3">
        <label className="label" htmlFor="w-note">{t('Σημείωση εγγύησης')}</label>
        <AutoField id="w-note" value={item.warranty.note ?? ''} placeholder={t('π.χ. επέκταση 5 ετών στον συμπιεστή')} onCommit={(v) => patch((c) => ({ ...c, warranty: { ...c.warranty, note: v.trim() || undefined } }))} />
      </div>
    </section>
  );
}
