/**
 * Εγγυήσεις για μέρη ενός προϊόντος (π.χ. «Συμπιεστής — 10 χρόνια», «Μπαταρία — 8 χρόνια»): η καθεμία με δική της
 * διάρκεια (από την ημερομηνία αγοράς του προϊόντος) ή συγκεκριμένη ημερομηνία λήξης. Έχουν δικές τους υπενθυμίσεις
 * (domain/reminders).
 */
import { useState } from 'react';
import { newId, type Item, type WarrantyPart } from '@/domain/model';
import { partInfo } from '@/domain/warranty';
import { today } from '@/domain/dates';
import { updateItem } from '@/data/library';
import { t } from '@/i18n';
import { AutoField, ConfirmDelete } from '@/components/controls';
import { warrantyText } from '@/components/WarrantyBadge';
import { IconPlus } from '@/components/icons';

const MAX_PARTS = 20;

export function PartWarranties({ item }: { item: Item }) {
  const parts = item.warranty.parts ?? [];
  const save = (fn: (ps: WarrantyPart[]) => WarrantyPart[]) =>
    void updateItem(item.id, (c) => { const next = fn(c.warranty.parts ?? []); return { ...c, warranty: { ...c.warranty, parts: next.length ? next : undefined } }; });
  const setPart = (id: string, patch: Partial<WarrantyPart>) => save((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  return (
    <div className="mt-4">
      {parts.length > 0 && <p className="label">{t('Εγγυήσεις για μέρη')}</p>}
      <ul className="space-y-2.5">
        {parts.map((p) => <PartRow key={p.id} item={item} part={p} onChange={(patch) => setPart(p.id, patch)} onRemove={() => save((ps) => ps.filter((x) => x.id !== p.id))} />)}
      </ul>
      {parts.length < MAX_PARTS && (
        <button type="button" className="mt-2.5 inline-flex items-center gap-1.5 text-[14px] font-semibold text-accent" onClick={() => save((ps) => [...ps, { id: newId(), name: '' }])}>
          <IconPlus className="text-base" />{t('Εγγύηση για μέρος')}
        </button>
      )}
    </div>
  );
}

function PartRow({ item, part, onChange, onRemove }: { item: Item; part: WarrantyPart; onChange: (p: Partial<WarrantyPart>) => void; onRemove: () => void }) {
  // διάρκεια σε χρόνια ή μήνες· αποθηκεύεται σε μήνες (μια διάρκεια που δεν είναι ακέραια χρόνια φαίνεται σε μήνες)
  const [unit, setUnit] = useState<'years' | 'months'>(part.months && part.months % 12 !== 0 ? 'months' : 'years');
  const shown = part.months === undefined ? '' : unit === 'years' ? String(part.months / 12) : String(part.months);
  const factor = (u: 'years' | 'months') => (u === 'years' ? 12 : 1);
  const commitLength = (v: string, u = unit) => {
    const n = Number(v.replace(',', '.'));
    const months = v.trim() && Number.isFinite(n) && n > 0 ? Math.round(n * factor(u)) : undefined;
    onChange({ months: months && months <= 600 ? months : undefined });
  };
  const w = partInfo(item, part, today());
  const tone = w.state === 'active' ? 'text-ok' : w.state === 'expiring' ? 'text-warn' : w.state === 'expired' ? 'text-bad' : 'text-ink-3';
  const ids = { name: `pw-name-${part.id}`, len: `pw-len-${part.id}`, until: `pw-until-${part.id}` };

  return (
    <li className="rounded-2xl bg-surface-2 p-3.5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <label className="label" htmlFor={ids.name}>{t('Μέρος')}</label>
          <AutoField id={ids.name} value={part.name} placeholder={t('π.χ. Συμπιεστής, Μοτέρ, Μπαταρία')} onCommit={(v) => onChange({ name: v.trim() })} />
        </div>
        <ConfirmDelete label={t('Διαγραφή εγγύησης μέρους')} onConfirm={onRemove} className="icon-btn mt-6" />
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2.5">
        <div>
          <label className="label" htmlFor={ids.len}>{t('Διάρκεια')}</label>
          <div className="flex gap-1.5">
            <AutoField id={ids.len} inputMode="decimal" className="input min-w-0" value={shown} onCommit={(v) => commitLength(v)} />
            <select aria-label={t('Μονάδα')} className="input w-[5.5rem] shrink-0 px-2" value={unit}
              onChange={(e) => { const u = e.target.value as 'years' | 'months'; setUnit(u); if (shown) commitLength(shown, u); }}>
              <option value="years">{t('χρόνια')}</option>
              <option value="months">{t('μήνες')}</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label" htmlFor={ids.until}>{t('ή λήγει στις')}</label>
          <input id={ids.until} type="date" className="input" value={part.until ?? ''} onChange={(e) => onChange({ until: e.target.value || undefined })} />
        </div>
      </div>
      <p className={`mt-2 text-[13px] font-semibold ${tone}`}>
        {w.state === 'none' ? t('Βάλε διάρκεια (από την ημερομηνία αγοράς) ή ημερομηνία λήξης.') : warrantyText(w)}
      </p>
    </li>
  );
}
