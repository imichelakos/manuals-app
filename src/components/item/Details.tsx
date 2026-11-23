/** Στοιχεία προϊόντος (όνομα, μάρκα, μοντέλο, σειριακός, κατηγορία, χώρος, ετικέτες) και ελεύθερες σημειώσεις. */
import { useId, useState } from 'react';
import { CATEGORIES, categoryById, type CategoryId } from '@/domain/categories';
import { suggestCategory } from '@/domain/categorySuggest';
import { GROUP_IDS, GROUP_LABELS, suggestGroup, type GroupId } from '@/domain/groups';
import type { Item } from '@/domain/model';
import { updateItem, useItems } from '@/data/library';
import { t } from '@/i18n';
import { AutoField } from '@/components/controls';
import { CategoryIcon } from '@/components/categoryIcons';

/**
 * Στοιχεία προϊόντος, πρώτα στην καρτέλα (διάταξη «Ταυτότητα πρώτα», 23/11/2026): συμπαγής μορφή για ανάγνωση και
 * «Επεξεργασία» για τη φόρμα. Ανοίγει σε επεξεργασία όταν το ζητά ο καλών (νέο προϊόν χωρίς σάρωση).
 */
export function DetailsSection({ item, startEditing = false }: { item: Item; startEditing?: boolean }) {
  const [editing, setEditing] = useState(startEditing);
  if (!editing) return <DetailsSummary item={item} onEdit={() => setEditing(true)} />;
  return <DetailsForm item={item} onDone={() => setEditing(false)} />;
}

function DetailsSummary({ item, onEdit }: { item: Item; onEdit: () => void }) {
  const group = item.group ?? suggestGroup(item);
  const rows: [string, string, boolean?][] = [
    [t('Μάρκα'), item.brand], [t('Μοντέλο'), item.model], [t('Σειριακός αριθμός'), item.serial, true],
    [t('Κατηγορία'), t(categoryById(item.category).label)], [t('Χώρος'), item.room],
    [t('Ομάδα'), group ? t(GROUP_LABELS[group]) : ''], [t('Ετικέτες'), item.tags.join(', ')],
  ];
  return (
    <section className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="section-title">{t('Στοιχεία')}</h2>
        <button type="button" className="btn btn-ghost -my-2 -mr-3 min-h-9 px-3 text-sm" onClick={onEdit}>{t('Επεξεργασία')}</button>
      </div>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[15px]">
        {rows.map(([k, v, mono]) => (
          <div key={k} className="contents">
            <dt className="text-ink-2">{k}</dt>
            <dd className={`min-w-0 break-words ${v ? 'font-semibold' : 'text-ink-3'} ${mono && v ? 'mono' : ''}`}>{v || '—'}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function DetailsForm({ item, onDone }: { item: Item; onDone: () => void }) {
  const items = useItems();
  const rooms = [...new Set(items.map((i) => i.room).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'el'));
  const listId = useId();
  // πρόταση μόνο όταν δεν έχει μπει κατηγορία («Άλλο»): δεν αλλάζει ποτέ μόνη της κάτι που διάλεξε ο χρήστης
  const suggested = item.category === 'other' ? suggestCategory(item, items) : null;
  const autoGroup = suggestGroup(item);
  const set = (patch: Partial<Item>) => void updateItem(item.id, (c) => ({ ...c, ...patch }));
  const field = (key: 'name' | 'brand' | 'model' | 'serial', label: string, extra?: { mono?: boolean; code?: boolean; placeholder?: string } /* code: κωδικός, χωρίς ορθογραφικό έλεγχο */) => (
    <div>
      <label className="label" htmlFor={`d-${key}`}>{label}</label>
      <AutoField id={`d-${key}`} value={item[key]} className={`input ${extra?.mono ? 'mono' : ''}`} placeholder={extra?.placeholder}
        autoComplete="off" spellCheck={!extra?.mono && !extra?.code} onCommit={(v) => set({ [key]: v.trim() })} />
    </div>
  );
  return (
    <section className="card space-y-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="section-title">{t('Στοιχεία')}</h2>
        <button type="button" className="btn btn-ghost -my-2 -mr-3 min-h-9 px-3 text-sm" onClick={onDone}>{t('Τέλος')}</button>
      </div>
      {field('name', t('Όνομα'), { placeholder: t('π.χ. Πλυντήριο ρούχων') })}
      <div className="grid grid-cols-2 gap-3">
        {field('brand', t('Μάρκα'))}
        {field('model', t('Μοντέλο'), { code: true })}
      </div>
      {field('serial', t('Σειριακός αριθμός'), { mono: true })}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label flex items-center gap-1.5" htmlFor="d-cat">{t('Κατηγορία')}<CategoryIcon id={item.category} className="text-base text-ink-2" /></label>
          <select id="d-cat" className="input" value={item.category} onChange={(e) => set({ category: e.target.value as CategoryId })}>
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{t(c.label)}</option>)}
          </select>
          {suggested && (
            <button type="button" className="chip mt-2 max-w-full" onClick={() => set({ category: suggested })}>
              <span className="truncate">{t('Πρόταση: {label}', { label: t(categoryById(suggested).label) })}</span>
            </button>
          )}
        </div>
        <div>
          <label className="label" htmlFor="d-room">{t('Χώρος')}</label>
          <AutoField id="d-room" value={item.room} list={listId} placeholder={t('π.χ. Κουζίνα')} onCommit={(v) => set({ room: v.trim() })} />
          <datalist id={listId}>{rooms.map((r) => <option key={r} value={r} />)}</datalist>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="d-group">{t('Ομάδα')}</label>
        <select id="d-group" className="input" value={item.group ?? ''} onChange={(e) => set({ group: (e.target.value || undefined) as GroupId | undefined })}>
          <option value="">{autoGroup ? t('Αυτόματα: {g}', { g: t(GROUP_LABELS[autoGroup]) }) : t('Αυτόματα: —')}</option>
          {GROUP_IDS.map((g) => <option key={g} value={g}>{t(GROUP_LABELS[g])}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="d-tags">{t('Ετικέτες')} <span className="font-normal text-ink-3">({t('χωρισμένες με κόμμα')})</span></label>
        <AutoField id="d-tags" value={item.tags.join(', ')} placeholder={t('π.χ. δώρο, εξοχικό')}
          onCommit={(v) => set({ tags: [...new Set(v.split(',').map((x) => x.trim().slice(0, 40)).filter(Boolean))].slice(0, 30) })} />
      </div>
    </section>
  );
}

export function NotesSection({ item }: { item: Item }) {
  return (
    <section className="card p-5">
      <h2 className="section-title"><label htmlFor="d-notes">{t('Σημειώσεις')}</label></h2>
      <AutoField id="d-notes" multiline value={item.notes} className="input mt-3 min-h-28 resize-y leading-relaxed"
        placeholder={t('Ό,τι θέλεις να θυμάσαι: ρυθμίσεις, συντήρηση, τηλέφωνο τεχνικού…')}
        onCommit={(v) => void updateItem(item.id, (c) => ({ ...c, notes: v.slice(0, 20_000) }))} />
    </section>
  );
}
