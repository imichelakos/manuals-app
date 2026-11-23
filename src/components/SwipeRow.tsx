/**
 * Γραμμή λίστας με σύρσιμο προς τα αριστερά, όπως στο iOS:
 *  - mode 'dismiss': πάνω από ένα όριο η ενέργεια γίνεται αμέσως (π.χ. διαγραφή ειδοποίησης — ακίνδυνη)·
 *  - mode 'reveal': εμφανίζεται κουμπί ενέργειας που πρέπει να πατηθεί (π.χ. διαγραφή προϊόντος — δεν αναιρείται).
 * Ο κάθετος κύλισμα της λίστας δεν επηρεάζεται (touch-action: pan-y)· ένα σύρσιμο ακυρώνει το πάτημα στη γραμμή.
 */
import { useRef, useState, type PointerEvent, type ReactNode } from 'react';

const START = 8;          // px πριν θεωρηθεί οριζόντιο σύρσιμο
const DISMISS_AT = 90;    // px για 'dismiss'
const REVEAL_WIDTH = 96;  // πλάτος του κουμπιού στο 'reveal'

export function SwipeRow({ children, mode, actionLabel, onAction, className = '', actionClass = 'bg-bad text-white' }: {
  children: ReactNode;
  mode: 'dismiss' | 'reveal';
  actionLabel: string;
  onAction: () => void;
  className?: string;
  actionClass?: string;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; id: number; base: number } | null>(null);
  const moved = useRef(false);
  const open = mode === 'reveal' && dx <= -REVEAL_WIDTH;

  const down = (e: PointerEvent) => { start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, base: dx }; moved.current = false; setDragging(true); };
  const move = (e: PointerEvent) => {
    const s = start.current;
    if (!s) return;
    const x = e.clientX - s.x, y = e.clientY - s.y;
    if (!moved.current && Math.abs(x) > START && Math.abs(x) > Math.abs(y)) { moved.current = true; (e.currentTarget as HTMLElement).setPointerCapture(s.id); }
    if (moved.current) setDx(Math.min(0, s.base + x));
  };
  const up = () => {
    if (mode === 'dismiss') { if (dx < -DISMISS_AT) onAction(); else setDx(0); }
    else setDx(dx < -REVEAL_WIDTH / 2 ? -REVEAL_WIDTH : 0);
    start.current = null;
    setDragging(false);
  };

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* η ενέργεια φαίνεται μόνο όσο η γραμμή είναι συρμένη (αλλιώς ξεχωρίζει στις στρογγυλεμένες γωνίες) */}
      {dx < 0 && (mode === 'reveal'
        ? <button type="button" tabIndex={open ? 0 : -1} aria-hidden={!open} onClick={() => { setDx(0); onAction(); }}
            className={`absolute inset-y-0 right-0 flex items-center justify-center text-sm font-bold ${actionClass}`} style={{ width: REVEAL_WIDTH }}>{actionLabel}</button>
        : <span className={`absolute inset-0 flex items-center justify-end pr-4 text-sm font-semibold ${actionClass}`} aria-hidden="true">{actionLabel}</span>)}
      <div className="relative touch-pan-y transition-transform" style={{ transform: `translateX(${dx}px)`, transitionDuration: dragging ? '0ms' : undefined }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onDragStart={(e) => e.preventDefault()} /* οι σύνδεσμοι (κάρτες) αλλιώς ξεκινούν «σύρσιμο συνδέσμου» και ακυρώνουν το σύρσιμο */
        onClickCapture={(e) => {
          // το «πάτημα» που στέλνει ο browser στο τέλος ενός συρσίματος αγνοείται· ένα κανονικό πάτημα σε ανοιχτή γραμμή την κλείνει
          if (moved.current) { e.preventDefault(); e.stopPropagation(); moved.current = false; return; }
          if (open) { e.preventDefault(); e.stopPropagation(); setDx(0); }
        }}>
        {children}
      </div>
    </div>
  );
}
