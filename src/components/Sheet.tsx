/**
 * Φύλλο διαλόγου: σε κινητό ανεβαίνει από κάτω, σε πλατιά οθόνη εμφανίζεται στο κέντρο. Κλείνει με Esc, με πάτημα στο
 * φόντο ή με το κουμπί· όσο είναι ανοιχτό η σελίδα από πίσω δεν κυλά και η εστίαση μένει μέσα του.
 * Στο iOS ένα σύρσιμο εκεί όπου δεν υπάρχει τι να κυλήσει περνά στην ίδια τη σελίδα και την τραβά ελαστικά — μαζί και το
 * φύλλο, που κατέβαινε και έκρυβε τις επιλογές του (24/11/2026). Το CSS overscroll-behavior δεν το σταματά σε στοιχεία
 * χωρίς περιεχόμενο που ξεχειλίζει (WebKit bug 243452)· γι' αυτό το σύρσιμο ακυρώνεται εδώ (touchmove), εκτός αν
 * κυλά το περιεχόμενο του φύλλου.
 */
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useLatest } from '@/hooks/useLatest';
import { IconClose } from './icons';
import { t } from '@/i18n';

export function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const close = useLatest(onClose);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); close.current(); }
      if (e.key !== 'Tab' || !ref.current) return;
      // η εστίαση κυκλώνει μέσα στο φύλλο
      const els = ref.current.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),input:not(:disabled),select,textarea,[tabindex="0"]');
      const first = els[0], last = els[els.length - 1];
      if (!first || !last) return;
      if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; before?.focus?.(); };
  }, [close]);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let lastY = 0;
    const onStart = (e: TouchEvent) => { lastY = e.touches[0]?.clientY ?? 0; };
    const onMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY ?? lastY;
      const down = y > lastY; // το δάχτυλο κατεβαίνει → το περιεχόμενο πάει προς την αρχή
      lastY = y;
      const c = body.current;
      const scrolls = !!c && c.contains(e.target as Node) && c.scrollHeight > c.clientHeight
        && !(down && c.scrollTop <= 0) && !(!down && c.scrollTop + c.clientHeight >= c.scrollHeight);
      if (!scrolls && e.cancelable) e.preventDefault();
    };
    // passive: false — αλλιώς το preventDefault αγνοείται
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    return () => { el.removeEventListener('touchstart', onStart); el.removeEventListener('touchmove', onMove); };
  }, []);

  return (
    <div ref={root} className="fixed inset-0 z-50 flex items-end justify-center wide:items-center wide:p-6">
      <div className="animate-fade absolute inset-0 bg-black/45" onClick={onClose} aria-hidden="true" />
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        className="animate-sheet relative flex max-h-[92dvh] w-full max-w-xl flex-col rounded-t-[28px] bg-bg shadow-card outline-hidden wide:max-h-[86dvh] wide:rounded-[28px]">
        <div className="flex items-center gap-2 px-5 pb-2 pt-4">
          <h2 id={titleId} className="flex-1 text-xl font-extrabold">{title}</h2>
          <button type="button" className="icon-btn -mr-2 bg-surface-2" onClick={onClose} aria-label={t('Κλείσιμο')}><IconClose className="text-xl" /></button>
        </div>
        <div ref={body} className="flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-1">{children}</div>
        {footer && <div className="border-t border-line px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">{footer}</div>}
      </div>
    </div>
  );
}
