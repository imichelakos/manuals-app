/** Εικονίδιο ανά κατηγορία προϊόντος (όταν δεν υπάρχει φωτογραφία εξωφύλλου). */
import type { SVGProps } from 'react';
import type { CategoryId } from '@/domain/categories';

const PATHS: Record<CategoryId, string[]> = {
  kitchen: ['M7 3h10a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M6 10h12', 'M9 6v1.5M9 13v3'],
  laundry: ['M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z', 'M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', 'M8 6h.01M11 6h.01'],
  av: ['M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z', 'M8 20h8M12 17v3'],
  computing: ['M5 5h14a1 1 0 0 1 1 1v9H4V6a1 1 0 0 1 1-1z', 'M2.5 18.5h19l-1.5-3.5H4z'],
  climate: ['M4 6h16a1 1 0 0 1 1 1v5H3V7a1 1 0 0 1 1-1z', 'M6 9.5h8', 'M7 15.5c0 1.5 1 1.5 1 3M12 15.5c0 1.5 1 1.5 1 3M17 15.5c0 1.5 1 1.5 1 3'],
  tools: ['M14.5 6.5a4 4 0 0 0-5.3 5.3L4 17l3 3 5.2-5.2a4 4 0 0 0 5.3-5.3L15 12l-3-3z'],
  care: ['M12 20s-7-4.4-7-9.5A4 4 0 0 1 12 8a4 4 0 0 1 7 2.5C19 15.6 12 20 12 20z'],
  kids: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M9 10h.01M15 10h.01', 'M8.5 14a4.5 4.5 0 0 0 7 0'],
  smart: ['M4 11.5 12 4l8 7.5', 'M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9', 'M9.5 15a3.5 3.5 0 0 1 5 0M12 17.5h.01'],
  vehicle: ['M5 16V11l2-5h10l2 5v5', 'M3.5 16h17M7 16v2M17 16v2', 'M7.5 12.5h.01M16.5 12.5h.01'],
  furniture: ['M5 11V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4', 'M3 12a2 2 0 0 1 4 0v3h10v-3a2 2 0 0 1 4 0v5H3z', 'M6 17v2M18 17v2'],
  other: ['m12 3 8 4.5v9L12 21l-8-4.5v-9z', 'm4 7.5 8 4.5 8-4.5M12 12v9'],
};

export function CategoryIcon({ id, ...p }: { id: CategoryId } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"
      width="1em" height="1em" aria-hidden="true" {...p}>
      {PATHS[id].map((d) => <path key={d} d={d} />)}
    </svg>
  );
}
