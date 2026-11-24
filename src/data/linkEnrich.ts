/**
 * Τίτλος και εικονίδιο για τους συνδέσμους ενός προϊόντος (μετά τη σάρωση ή την προσθήκη συνδέσμου — απόφαση
 * 23/11/2026: αυτόματα), και ο τελικός σύνδεσμος μετά από ανακατευθύνσεις (bit.ly → YouTube). Ο τίτλος αλλάζει ΜΟΝΟ όσο είναι ακόμη ο γενικός («Βίντεο», «Ιστοσελίδα»…), ποτέ ένας τίτλος
 * που έγραψε ο χρήστης. Ένας-ένας, στο παρασκήνιο· χωρίς σύνδεση απλώς δεν αλλάζει τίποτα.
 */
import { getItem, updateItem } from './library';
import { fetchLinkPreview } from '@/services/linkPreview';
import type { LinkKind } from '@/domain/model';
import { linkKind, parseHttpUrl } from '@/domain/codes';

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
      if (!p) continue;
      // μόνο ο τελικός σύνδεσμος κρατιέται (απόφαση 23/11/2026): bit.ly → YouTube γίνεται ο σύνδεσμος του YouTube
      const final = parseHttpUrl(p.finalUrl);
      await updateItem(itemId, (c) => {
        const cur = c.links.find((x) => x.id === link.id);
        if (!cur) return c;
        const url = final && final.href !== cur.url ? final.href : cur.url;
        // ο ίδιος τελικός σύνδεσμος υπάρχει ήδη: αυτός περισσεύει
        if (url !== cur.url && c.links.some((x) => x.id !== cur.id && x.url === url)) return { ...c, links: c.links.filter((x) => x.id !== cur.id) };
        const kind = url !== cur.url ? linkKind(final!) : cur.kind;
        const stillGeneric = cur.title === genericTitle(cur.kind);
        const title = stillGeneric ? (p.title ?? genericTitle(kind)).slice(0, 300) : cur.title;
        return { ...c, links: c.links.map((x) => (x.id !== cur.id ? x : { ...x, url, kind, title, icon: x.icon ?? p.icon ?? undefined })) };
      });
    } finally { running.delete(link.id); }
  }
}
