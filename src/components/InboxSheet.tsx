/**
 * Λίστα ειδοποιήσεων (data/inbox): υπενθυμίσεις εγγύησης που έχουν «χτυπήσει». Πάτημα → καρτέλα του προϊόντος.
 * Διαγραφή με σύρσιμο προς τα αριστερά, ή με το κουμπί × (για όσους δεν μπορούν ή δεν θέλουν να σύρουν, π.χ. VoiceOver).
 */
import { useNavigate } from 'react-router';
import type { DueReminder } from '@/domain/reminders';
import { dismiss, useInbox } from '@/data/inbox';
import { reminderMessage } from '@/data/reminderRuntime';
import { daysBetween, today } from '@/domain/dates';
import { fmtDate, t, tn } from '@/i18n';
import { Sheet } from './Sheet';
import { SwipeRow } from './SwipeRow';
import { IconBell, IconClose } from './icons';

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
  return (
    <li>
      <SwipeRow mode="dismiss" actionLabel={t('Διαγραφή')} onAction={() => dismiss([r.key])} className="rounded-2xl" actionClass="bg-bad-soft text-bad">
        <div className="flex items-start gap-3 bg-surface-2 p-3.5">
          <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}>
            <p className="text-[15px] font-bold">{m.title}</p>
            <p className="mt-0.5 text-[14px] leading-snug text-ink-2">{m.body}</p>
            <p className="mt-1 text-[12px] text-ink-3">{fmtDate(r.date)}</p>
          </button>
          <button type="button" className="icon-btn -mr-1 -mt-1 size-9 shrink-0" aria-label={t('Διαγραφή ειδοποίησης')} onClick={() => dismiss([r.key])}>
            <IconClose className="text-lg" />
          </button>
        </div>
      </SwipeRow>
    </li>
  );
}
