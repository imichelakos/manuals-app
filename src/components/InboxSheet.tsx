/**
 * Λίστα ειδοποιήσεων (data/inbox): υπενθυμίσεις εγγύησης που έχουν «χτυπήσει». Πάτημα → καρτέλα του προϊόντος.
 * Διαγραφή με σύρσιμο προς τα αριστερά, ή με το κουμπί × (για όσους δεν μπορούν ή δεν θέλουν να σύρουν, π.χ. VoiceOver).
 */
import { useRef, useState, type PointerEvent } from 'react';
import { useNavigate } from 'react-router';
import type { DueReminder } from '@/domain/reminders';
import { dismiss, useInbox } from '@/data/inbox';
import { reminderMessage } from '@/data/reminderRuntime';
import { daysBetween, today } from '@/domain/dates';
import { fmtDate, t, tn } from '@/i18n';
import { Sheet } from './Sheet';
import { IconBell, IconClose } from './icons';

/** απόσταση συρσίματος (px) πάνω από την οποία η ειδοποίηση σβήνεται */
const SWIPE_DISMISS = 90;

export function InboxSheet({ onClose }: { onClose: () => void }) {
  const list = useInbox();
  const nav = useNavigate();
  return (
    <Sheet title={t('Ειδοποιήσεις')} onClose={onClose} footer={list.length > 1 ? (
      <button type="button" className="btn btn-plain w-full" onClick={() => dismiss(list.map((r) => r.key))}>{t('Διαγραφή όλων')}</button>
    ) : undefined}>
      {list.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center text-ink-2">
          <IconBell className="text-4xl text-ink-3" />
          <p className="mt-3 text-[15px]">{t('Δεν υπάρχουν ειδοποιήσεις.')}</p>
        </div>
      ) : (
        <>
          <p className="mb-3 text-[13px] text-ink-3">{t('Σύρε αριστερά για διαγραφή.')}</p>
          <ul className="space-y-2.5">
            {list.map((r) => <Row key={r.key} r={r} onOpen={() => { onClose(); nav(`/item/${r.itemId}`); }} />)}
          </ul>
        </>
      )}
    </Sheet>
  );
}

/** Ο τίτλος στη λίστα λογαριάζεται από ΣΗΜΕΡΑ (η ειδοποίηση μπορεί να «χτύπησε» μέρες πριν). */
function title(r: DueReminder): string {
  const left = daysBetween(today(), r.until) ?? 0;
  return left < 0 ? t('Η εγγύηση έληξε') : left === 0 ? t('Η εγγύηση λήγει σήμερα') : tn(left, 'Η εγγύηση λήγει σε {n} ημέρα', 'Η εγγύηση λήγει σε {n} ημέρες');
}

function Row({ r, onOpen }: { r: DueReminder; onOpen: () => void }) {
  const m = { ...reminderMessage(r), title: title(r) };
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const moved = useRef(false);
  const down = (e: PointerEvent) => { start.current = { x: e.clientX, y: e.clientY, id: e.pointerId }; moved.current = false; setDragging(true); };
  const move = (e: PointerEvent) => {
    const s = start.current;
    if (!s) return;
    const x = e.clientX - s.x, y = e.clientY - s.y;
    if (!moved.current && Math.abs(x) > 8 && Math.abs(x) > Math.abs(y)) { moved.current = true; (e.currentTarget as HTMLElement).setPointerCapture(s.id); }
    if (moved.current) setDx(Math.min(0, x));
  };
  const up = () => {
    if (dx < -SWIPE_DISMISS) dismiss([r.key]); else setDx(0);
    start.current = null;
    setDragging(false);
  };
  return (
    <li className="relative overflow-hidden rounded-2xl bg-bad-soft">
      <span className="absolute inset-y-0 right-4 flex items-center text-sm font-semibold text-bad" aria-hidden="true">{t('Διαγραφή')}</span>
      <div className="relative flex touch-pan-y items-start gap-3 bg-surface-2 p-3.5 transition-transform" style={{ transform: `translateX(${dx}px)`, transitionDuration: dragging ? '0ms' : undefined }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => { if (!moved.current) onOpen(); }}>
          <p className="text-[15px] font-bold">{m.title}</p>
          <p className="mt-0.5 text-[14px] leading-snug text-ink-2">{m.body}</p>
          <p className="mt-1 text-[12px] text-ink-3">{fmtDate(r.date)}</p>
        </button>
        <button type="button" className="icon-btn -mr-1 -mt-1 size-9 shrink-0" aria-label={t('Διαγραφή ειδοποίησης')} onClick={() => dismiss([r.key])}>
          <IconClose className="text-lg" />
        </button>
      </div>
    </li>
  );
}
