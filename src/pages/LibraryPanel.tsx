/**
 * Η βιβλιοθήκη: αναζήτηση, γρήγορα φίλτρα, λίστα προϊόντων. Σε κινητό είναι η αρχική οθόνη· σε πλατιά οθόνη μένει
 * μόνιμα στα αριστερά και η καρτέλα του προϊόντος ανοίγει δίπλα.
 */
import { useDeferredValue, useMemo, useState } from 'react';
import { Link, useMatch } from 'react-router';
import { useItems } from '@/data/library';
import { setViewState, useViewState } from '@/data/viewState';
import { buildIndex, facets, search, activeFilterCount, NO_FILTERS, type Filters } from '@/domain/search';
import { hasDigitalManual } from '@/domain/model';
import { warrantyInfo } from '@/domain/warranty';
import { today } from '@/domain/dates';
import { t, tn } from '@/i18n';
import { ItemCard } from '@/components/ItemCard';
import { FilterSheet } from '@/components/FilterSheet';
import { IconClose, IconFilter, IconPlus, IconRecycle, IconScan, IconSearch, IconShield, IconFile } from '@/components/icons';

export default function LibraryPanel() {
  const items = useItems();
  const { query, filters, sort } = useViewState();
  const [sheet, setSheet] = useState(false);
  const selected = useMatch('/item/:id')?.params.id;
  const now = today();

  const index = useMemo(() => buildIndex(items), [items]);
  // η λίστα ακολουθεί την πληκτρολόγηση χωρίς να την καθυστερεί
  const q = useDeferredValue(query);
  const results = useMemo(() => search(index, { query: q, filters, sort, today: now }), [index, q, filters, sort, now]);
  const counts = useMemo(() => facets(index, { query: q, filters, today: now }), [index, q, filters, now]);

  const stats = useMemo(() => ({
    recycled: items.filter((i) => i.paper === 'recycled').length,
    ready: items.filter((i) => i.paper === 'kept' && hasDigitalManual(i)).length,
    missing: items.filter((i) => !hasDigitalManual(i)).length,
    expiring: items.filter((i) => warrantyInfo(i, now).state === 'expiring').length,
  }), [items, now]);

  const setFilters = (f: Filters) => setViewState({ filters: f });
  const same = (a: Filters, b: Partial<Filters>) => (Object.keys(b) as (keyof Filters)[]).every((k) => JSON.stringify(a[k]) === JSON.stringify(b[k]));
  // γρήγορα φίλτρα: ένα πάτημα εφαρμόζει τον συνδυασμό, δεύτερο τον αφαιρεί
  const quick: { key: string; label: string; n: number; icon: React.ReactNode; set: Partial<Filters>; unset: Partial<Filters> }[] = [
    { key: 'ready', label: t('Έτοιμα για ανακύκλωση'), n: stats.ready, icon: <IconRecycle />, set: { manual: 'yes', paper: 'kept' }, unset: { manual: 'any', paper: 'any' } },
    { key: 'missing', label: t('Χωρίς ψηφιακό'), n: stats.missing, icon: <IconFile />, set: { manual: 'no' }, unset: { manual: 'any' } },
    { key: 'expiring', label: t('Η εγγύηση λήγει σύντομα'), n: stats.expiring, icon: <IconShield />, set: { warranty: ['expiring'] }, unset: { warranty: [] } },
  ];
  const active = activeFilterCount(filters);
  const filtered = q.trim() !== '' || active > 0;

  return (
    <div className="mx-auto flex min-h-full max-w-2xl flex-col px-4 pb-6 pt-[calc(1rem+env(safe-area-inset-top))] wide:max-w-none wide:px-4">
      <header className="flex items-end justify-between gap-3 pb-3 pt-2">
        <div>
          <h1 className="text-[32px] font-extrabold leading-tight">{t('Βιβλιοθήκη')}</h1>
          <p className="mt-0.5 text-sm text-ink-2">
            {items.length === 0 ? t('Όλα τα εγχειρίδιά σου, χωρίς χαρτί')
              : `${tn(items.length, '{n} προϊόν', '{n} προϊόντα')} · ${tn(stats.recycled, '{n} έντυπο ανακυκλώθηκε', '{n} έντυπα ανακυκλώθηκαν')}`}
          </p>
        </div>
      </header>

      {items.length === 0 ? <Empty /> : (
        <>
          <div className="sticky top-0 z-10 -mx-4 bg-bg/90 px-4 pb-2 pt-1 backdrop-blur-md">
            <div className="relative">
              <IconSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl text-ink-3" />
              <input type="search" inputMode="search" enterKeyHint="search" autoComplete="off" autoCorrect="off" spellCheck={false}
                className="input rounded-full pl-12 pr-12" placeholder={t('Όνομα, μάρκα, μοντέλο…')} aria-label={t('Αναζήτηση')}
                value={query} onChange={(e) => setViewState({ query: e.target.value })} />
              {query && (
                <button type="button" className="icon-btn absolute right-1 top-1/2 size-9 -translate-y-1/2" onClick={() => setViewState({ query: '' })} aria-label={t('Καθαρισμός αναζήτησης')}>
                  <IconClose className="text-lg" />
                </button>
              )}
            </div>
            <div className="no-scrollbar -mx-4 mt-2.5 flex gap-2 overflow-x-auto px-4 pb-1">
              <button type="button" className={`chip ${active ? 'chip-on' : ''}`} onClick={() => setSheet(true)}>
                <IconFilter className="text-base" />{t('Φίλτρα')}{active > 0 && <span className="rounded-full bg-bg px-1.5 text-xs font-bold text-ink">{active}</span>}
              </button>
              {quick.filter((c) => c.n > 0 || same(filters, c.set)).map((c) => {
                const on = same(filters, c.set);
                return (
                  <button key={c.key} type="button" aria-pressed={on} className={`chip ${on ? 'chip-on' : ''}`}
                    onClick={() => setFilters({ ...filters, ...(on ? c.unset : c.set) })}>
                    <span className="text-base">{c.icon}</span>{c.label}<span className={on ? 'opacity-70' : 'text-ink-3'}>{c.n}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pb-2 pt-1 text-sm text-ink-2" aria-live="polite">
            <span>{filtered ? tn(results.length, '{n} αποτέλεσμα', '{n} αποτελέσματα') : t('Όλα τα προϊόντα')}</span>
            {filtered && <button type="button" className="font-semibold text-accent" onClick={() => setViewState({ query: '', filters: NO_FILTERS })}>{t('Καθαρισμός')}</button>}
          </div>

          {results.length === 0 ? (
            <div className="card mt-2 p-6 text-center">
              <p className="font-bold">{t('Δεν βρέθηκε κάτι')}</p>
              <p className="mt-1 text-sm text-ink-2">{t('Δοκίμασε λιγότερες λέξεις ή αφαίρεσε κάποιο φίλτρο.')}</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {results.map((i) => <li key={i.id}><ItemCard item={i} selected={i.id === selected} /></li>)}
            </ul>
          )}
        </>
      )}

      {sheet && <FilterSheet filters={filters} sort={sort} counts={counts} onChange={setFilters} onSort={(s) => setViewState({ sort: s })} onClose={() => setSheet(false)} />}
    </div>
  );
}

function Empty() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
      <div className="relative mb-6 flex size-28 items-center justify-center rounded-[2rem] bg-accent-soft text-5xl text-accent">
        <IconScan />
        <span className="absolute -bottom-2 -right-2 flex size-11 items-center justify-center rounded-full bg-ok-soft text-2xl text-ok ring-4 ring-bg"><IconRecycle /></span>
      </div>
      <h2 className="text-2xl font-extrabold">{t('Ξεκίνα με το πρώτο σου έντυπο')}</h2>
      <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-ink-2">
        {t('Φωτογράφισε το εξώφυλλο ενός εγχειριδίου. Βρίσκουμε μάρκα, μοντέλο και QR, σε βοηθάμε να κρατήσεις το ψηφιακό, και το χαρτί πάει ανακύκλωση.')}
      </p>
      <Link to="/scan" className="btn btn-primary mt-6 w-full max-w-xs text-base"><IconScan className="text-xl" />{t('Σάρωση εντύπου')}</Link>
      <Link to="/scan?manual=1" className="btn btn-ghost mt-1 w-full max-w-xs"><IconPlus className="text-lg" />{t('Προσθήκη χωρίς σάρωση')}</Link>
    </div>
  );
}
