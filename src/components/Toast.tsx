/** Σύντομα μηνύματα επιβεβαίωσης/σφάλματος στο κάτω μέρος της οθόνης. `toast()` από οπουδήποτε. */
import { useSyncExternalStore } from 'react';
import { IconCheck, IconWarn } from './icons';

interface Msg { id: number; text: string; kind: 'ok' | 'error' }
let msgs: Msg[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(text: string, kind: Msg['kind'] = 'ok') {
  const id = ++seq;
  msgs = [...msgs.slice(-2), { id, text, kind }];
  emit();
  setTimeout(() => { msgs = msgs.filter((m) => m.id !== id); emit(); }, kind === 'error' ? 6000 : 3200);
}

export function Toasts() {
  const list = useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => msgs);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] flex flex-col items-center gap-2 px-4 wide:bottom-8" role="status" aria-live="polite">
      {list.map((m) => (
        <div key={m.id} className={`animate-pop flex max-w-md items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-semibold shadow-card ${m.kind === 'error' ? 'bg-bad text-bg' : 'bg-ink text-bg'}`}>
          {m.kind === 'error' ? <IconWarn className="shrink-0 text-lg" /> : <IconCheck className="shrink-0 text-lg" />}
          <span>{m.text}</span>
        </div>
      ))}
    </div>
  );
}
