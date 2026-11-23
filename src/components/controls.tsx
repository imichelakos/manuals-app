/** Μικρά κοινά στοιχεία φόρμας: πεδίο κειμένου με αυτόματη αποθήκευση, επιλογή αρχείου, κουμπί διαγραφής με επιβεβαίωση. */
import { useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { useLatest } from '@/hooks/useLatest';
import { expectAppSwitch } from '@/services/appSwitch';
import { t } from '@/i18n';
import { IconTrash } from './icons';

/**
 * Πεδίο που αποθηκεύει μόνο του: στο blur ή λίγο αφότου σταματήσει η πληκτρολόγηση. Η τιμή από έξω (`value`) το
 * ενημερώνει μόνο όταν ο χρήστης δεν γράφει εκείνη τη στιγμή.
 */
export function AutoField({ value, onCommit, multiline, className = 'input', ...rest }: {
  value: string; onCommit: (v: string) => void; multiline?: boolean; className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useLatest({ value, onCommit });
  // τιμή που άλλαξε από έξω (π.χ. πρόταση από την απόδειξη) αντικαθιστά το πρόχειρο — όχι όσο ο χρήστης γράφει
  const [seen, setSeen] = useState(value);
  if (seen !== value) { setSeen(value); if (!editing) setDraft(value); }
  const commit = (v: string) => { clearTimeout(timer.current); const c = latest.current; if (v !== c.value) c.onCommit(v); };
  const pending = useLatest(draft);
  useEffect(() => () => { clearTimeout(timer.current); const c = latest.current; if (pending.current !== c.value) c.onCommit(pending.current); }, [latest, pending]); // αποθήκευση και όταν φύγει από την οθόνη
  const props = {
    value: draft,
    className,
    onFocus: () => setEditing(true),
    onBlur: (e: { target: { value: string } }) => { setEditing(false); commit(e.target.value); },
    onChange: (e: { target: { value: string } }) => { const v = e.target.value; setDraft(v); clearTimeout(timer.current); timer.current = setTimeout(() => commit(v), 700); },
  };
  return multiline
    ? <textarea {...props} rows={4} placeholder={rest.placeholder} aria-label={rest['aria-label']} id={rest.id} />
    : <input {...rest} {...props} />;
}

/**
 * Πεδίο «Άλλο» δίπλα σε έτοιμες επιλογές (π.χ. 12/24/36 μήνες): δείχνει την τιμή μόνο όταν δεν είναι μία από αυτές.
 * Αποθηκεύει ΟΤΑΝ ΤΕΛΕΙΩΣΕΙ ο χρήστης (έξοδος από το πεδίο ή Enter), όχι σε κάθε ψηφίο: έτσι ο καλών μπορεί να κάνει την
 * τιμή chip χωρίς το πεδίο να αδειάζει στη μέση της πληκτρολόγησης. Κενό πεδίο → onChange(undefined).
 */
export function OtherNumber({ value, presets, min, max, onChange, label, placeholder, className }: {
  value: number | undefined; presets: readonly number[]; min: number; max: number;
  onChange: (n: number | undefined) => void; label: string; placeholder?: string; className?: string;
}) {
  const shown = value !== undefined && !presets.includes(value) ? String(value) : '';
  const [draft, setDraft] = useState<string | null>(null); // null: δεν γράφει
  const commit = () => {
    if (draft === null) return;
    const n = Number(draft);
    if (!draft) { if (shown) onChange(undefined); } // άδειασε το πεδίο της δικής του τιμής
    else if (Number.isInteger(n) && n >= min && n <= max && n !== value) onChange(n);
    setDraft(null);
  };
  return (
    <input type="number" inputMode="numeric" enterKeyHint="done" min={min} max={max} aria-label={label} placeholder={placeholder} className={className}
      value={draft ?? shown}
      onFocus={() => setDraft(shown)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, String(max).length))} />
  );
}

/** Κουμπί που ανοίγει την κάμερα ή τον επιλογέα αρχείων του συστήματος. */
export function FilePick({ onFiles, accept, capture, multiple, className, children, disabled }: {
  onFiles: (files: File[]) => void; accept: string; capture?: boolean; multiple?: boolean; className?: string; children: ReactNode; disabled?: boolean;
}) {
  return (
    <label onClick={expectAppSwitch} className={`${className ?? ''} ${disabled ? 'pointer-events-none opacity-40' : 'cursor-pointer'} focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent`}>
      {children}
      <input type="file" className="sr-only" accept={accept} multiple={multiple} disabled={disabled}
        {...(capture ? { capture: 'environment' as const } : {})}
        onChange={(e) => { const f = [...(e.target.files ?? [])]; e.target.value = ''; if (f.length) onFiles(f); }} />
    </label>
  );
}
export const IMAGE_TYPES = 'image/*';
export const DOC_TYPES = 'application/pdf,image/*';

/** Διαγραφή σε δύο πατήματα: το πρώτο ζητά επιβεβαίωση («Σίγουρα;») για λίγα δευτερόλεπτα. */
export function ConfirmDelete({ onConfirm, label, className = 'icon-btn' }: { onConfirm: () => void; label: string; className?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const id = setTimeout(() => setArmed(false), 3500); return () => clearTimeout(id); }, [armed]);
  return armed
    ? <button type="button" className="btn btn-danger min-h-9 px-3 py-1 text-sm" onClick={() => { setArmed(false); onConfirm(); }}>{t('Σίγουρα;')}</button>
    : <button type="button" className={className} aria-label={label} onClick={() => setArmed(true)}><IconTrash className="text-xl" /></button>;
}

/** Επιλογή ενός από λίγα (2–4) με κουμπιά δίπλα-δίπλα, όπως το segmented control του iOS: ένα πάτημα, χωρίς λίστα. */
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex rounded-xl bg-surface-2 p-0.5">
      {options.map(([v, text]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className={`min-h-9 flex-1 rounded-[10px] px-2.5 text-[14px] font-semibold transition ${value === v ? 'bg-surface text-ink shadow-card' : 'text-ink-2'}`}>{text}</button>
      ))}
    </div>
  );
}

/** Διακόπτης ναι/όχι (όπως στο iOS). */
export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={`relative h-8 w-14 shrink-0 rounded-full transition disabled:opacity-40 ${on ? 'bg-ok' : 'bg-surface-2'}`}>
      <span className={`absolute top-1 size-6 rounded-full bg-surface shadow-card transition-all ${on ? 'left-7' : 'left-1'}`} />
    </button>
  );
}
