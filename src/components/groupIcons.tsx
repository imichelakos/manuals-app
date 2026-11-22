/** Εικονίδιο ανά ομάδα προϊόντων (domain/groups): μεγάλη συσκευή, μικρή συσκευή, ηλεκτρονικά, χωρίς ρεύμα. */
import type { SVGProps } from 'react';
import type { GroupId } from '@/domain/groups';

const PATHS: Record<GroupId, string[]> = {
  large: ['M6 2.5h12a1 1 0 0 1 1 1v17a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-17a1 1 0 0 1 1-1z', 'M5 9h14', 'M8 5.5v1.5M8 12v3'],
  small: ['M9 3v5M15 3v5', 'M6 8h12v3a6 6 0 0 1-12 0z', 'M12 17v4'],
  electronics: ['M8 2.5h8A1.5 1.5 0 0 1 17.5 4v16a1.5 1.5 0 0 1-1.5 1.5H8A1.5 1.5 0 0 1 6.5 20V4A1.5 1.5 0 0 1 8 2.5z', 'M11 18.5h2'],
  unpowered: ['M9 3v5M15 3v5', 'M6 8h12v3a6 6 0 0 1-12 0z', 'M12 17v4', 'M3.5 3.5l17 17'],
};

export function GroupIcon({ id, ...p }: { id: GroupId } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
      width="1em" height="1em" aria-hidden="true" {...p}>
      {PATHS[id].map((d) => <path key={d} d={d} />)}
    </svg>
  );
}
