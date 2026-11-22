/** Όλα τα φίλτρα και η ταξινόμηση. Δίπλα σε κάθε επιλογή, πόσα προϊόντα θα έδινε· επιλογές με 0 δεν πατιούνται. */
import { GROUP_IDS, GROUP_LABELS, type GroupId } from '@/domain/groups';
import type { ReactNode } from 'react';
import { CATEGORIES, type CategoryId } from '@/domain/categories';
import { NO_FILTERS, type Facets, type Filters, type Sort, type YesNo } from '@/domain/search';
import type { WarrantyState } from '@/domain/warranty';
import { t, tn } from '@/i18n';
import { Sheet } from './Sheet';

const toggle = <T,>(list: T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="mt-5 first:mt-1">
      <legend className="section-title mb-2.5">{title}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Opt({ on, n, onClick, children }: { on: boolean; n?: number; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} disabled={!on && n === 0} className={`chip ${on ? 'chip-on' : ''} disabled:opacity-40`} onClick={onClick}>
      {children}{n !== undefined && <span className={on ? 'opacity-70' : 'text-ink-3'}>{n}</span>}
    </button>
  );
}

export function FilterSheet({ filters: f, sort, counts, onChange, onSort, onClose }: {
  filters: Filters; sort: Sort; counts: Facets; onChange: (f: Filters) => void; onSort: (s: Sort) => void; onClose: () => void;
}) {
  const yn = (key: 'manual' | 'receipt', v: YesNo) => onChange({ ...f, [key]: f[key] === v ? 'any' : v });
  const sorts: [Sort, string][] = [['relevance', t('Συνάφεια / πρόσφατα')], ['recent', t('Τελευταία αλλαγή')], ['name', t('Όνομα')], ['warranty', t('Λήξη εγγύησης')]];
  const warranty: [WarrantyState, string][] = [['active', t('Ενεργή')], ['expiring', t('Λήγει σύντομα')], ['expired', t('Έχει λήξει')], ['none', t('Χωρίς στοιχεία')]];
  const brands = [...new Set([...counts.brands.keys(), ...f.brands])].map((k) => ({ k, label: counts.brands.get(k)?.label ?? k, n: counts.brands.get(k)?.n ?? 0 }))
    .sort((a, b) => a.label.localeCompare(b.label, 'el'));
  const rooms = [...new Set([...counts.rooms.keys(), ...f.rooms])].sort((a, b) => a.localeCompare(b, 'el'));
  const tags = [...new Set([...counts.tags.keys(), ...f.tags])].sort((a, b) => a.localeCompare(b, 'el'));
  const cats = CATEGORIES.filter((c) => counts.categories.has(c.id) || f.categories.includes(c.id));

  return (
    <Sheet title={t('Φίλτρα')} onClose={onClose} footer={
      <div className="flex gap-3">
        <button type="button" className="btn btn-plain flex-1" onClick={() => onChange(NO_FILTERS)}>{t('Καθαρισμός')}</button>
        <button type="button" className="btn btn-primary flex-[2]" onClick={onClose}>{tn(counts.total, 'Εμφάνιση {n} προϊόντος', 'Εμφάνιση {n} προϊόντων')}</button>
      </div>
    }>
      <Group title={t('Ταξινόμηση')}>
        {sorts.map(([id, label]) => <Opt key={id} on={sort === id} onClick={() => onSort(id)}>{label}</Opt>)}
      </Group>
      <Group title={t('Ψηφιακό εγχειρίδιο')}>
        <Opt on={f.manual === 'yes'} n={counts.manual.yes} onClick={() => yn('manual', 'yes')}>{t('Υπάρχει')}</Opt>
        <Opt on={f.manual === 'no'} n={counts.manual.no} onClick={() => yn('manual', 'no')}>{t('Λείπει')}</Opt>
      </Group>
      <Group title={t('Έντυπο')}>
        <Opt on={f.paper === 'kept'} n={counts.paper.kept} onClick={() => onChange({ ...f, paper: f.paper === 'kept' ? 'any' : 'kept' })}>{t('Το έχω ακόμη')}</Opt>
        <Opt on={f.paper === 'recycled'} n={counts.paper.recycled} onClick={() => onChange({ ...f, paper: f.paper === 'recycled' ? 'any' : 'recycled' })}>{t('Ανακυκλώθηκε')}</Opt>
      </Group>
      <Group title={t('Εγγύηση')}>
        {warranty.map(([id, label]) => <Opt key={id} on={f.warranty.includes(id)} n={counts.warranty.get(id) ?? 0} onClick={() => onChange({ ...f, warranty: toggle(f.warranty, id) })}>{label}</Opt>)}
      </Group>
      <Group title={t('Παραστατικό αγοράς')}>
        <Opt on={f.receipt === 'yes'} n={counts.receipt.yes} onClick={() => yn('receipt', 'yes')}>{t('Υπάρχει')}</Opt>
        <Opt on={f.receipt === 'no'} n={counts.receipt.no} onClick={() => yn('receipt', 'no')}>{t('Λείπει')}</Opt>
      </Group>
      {GROUP_IDS.some((g) => counts.groups.has(g) || f.groups.includes(g)) && (
        <Group title={t('Ομάδα')}>
          {GROUP_IDS.filter((g) => counts.groups.has(g) || f.groups.includes(g)).map((g) => (
            <Opt key={g} on={f.groups.includes(g)} n={counts.groups.get(g) ?? 0} onClick={() => onChange({ ...f, groups: toggle<GroupId>(f.groups, g) })}>{t(GROUP_LABELS[g])}</Opt>
          ))}
        </Group>
      )}
      {cats.length > 0 && (
        <Group title={t('Κατηγορία')}>
          {cats.map((c) => <Opt key={c.id} on={f.categories.includes(c.id)} n={counts.categories.get(c.id) ?? 0} onClick={() => onChange({ ...f, categories: toggle<CategoryId>(f.categories, c.id) })}>{t(c.label)}</Opt>)}
        </Group>
      )}
      {brands.length > 0 && (
        <Group title={t('Μάρκα')}>
          {brands.map((b) => <Opt key={b.k} on={f.brands.includes(b.k)} n={b.n} onClick={() => onChange({ ...f, brands: toggle(f.brands, b.k) })}>{b.label}</Opt>)}
        </Group>
      )}
      {rooms.length > 0 && (
        <Group title={t('Χώρος')}>
          {rooms.map((r) => <Opt key={r} on={f.rooms.includes(r)} n={counts.rooms.get(r) ?? 0} onClick={() => onChange({ ...f, rooms: toggle(f.rooms, r) })}>{r}</Opt>)}
        </Group>
      )}
      {tags.length > 0 && (
        <Group title={t('Ετικέτες')}>
          {tags.map((x) => <Opt key={x} on={f.tags.includes(x)} n={counts.tags.get(x) ?? 0} onClick={() => onChange({ ...f, tags: toggle(f.tags, x) })}>{x}</Opt>)}
        </Group>
      )}
    </Sheet>
  );
}
