/**
 * Τίτλος και εικονίδιο για τους συνδέσμους ενός προϊόντος (μετά τη σάρωση ή την προσθήκη συνδέσμου — απόφαση
 * 23/11/2026: αυτόματα). Ο τίτλος αλλάζει ΜΟΝΟ όσο είναι ακόμη ο γενικός («Βίντεο», «Ιστοσελίδα»…), ποτέ ένας τίτλος
 * που έγραψε ο χρήστης. Ένας-ένας, στο παρασκήνιο· χωρίς σύνδεση απλώς δεν αλλάζει τίποτα.
 */
import { getItem, updateItem } from './library';
import { fetchLinkPreview } from '@/services/linkPreview';
import type { LinkKind } from '@/domain/model';

/** ids συνδέσμων που ψάχνονται τώρα: όχι δεύτερη αναζήτηση για τον ίδιο σύνδεσμο ταυτόχρονα */
const running = new Set<string>();

export async function enrichLinks(itemId: string, genericTitle: (kind: LinkKind) => string): Promise<void> {
  const item = getItem(itemId);
  if (!item) return;
  for (const link of item.links) {
    const generic = link.title === genericTitle(link.kind);
    if ((!generic && link.icon) || running.has(link.id)) continue;
    running.add(link.id);
    try {
      const p = await fetchLinkPreview(link.url);
      if (!p || (!p.title && !p.icon)) continue;
      await updateItem(itemId, (c) => ({
        ...c,
        links: c.links.map((x) => (x.id !== link.id ? x : {
          ...x,
          title: p.title && x.title === genericTitle(x.kind) ? p.title.slice(0, 300) : x.title,
          icon: x.icon ?? p.icon ?? undefined,
        })),
      }));
    } finally { running.delete(link.id); }
  }
}
