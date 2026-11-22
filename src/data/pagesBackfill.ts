/**
 * Μία φορά, στο παρασκήνιο: μετρά τις σελίδες των PDF εγχειριδίων που αποθηκεύτηκαν πριν η εφαρμογή κρατά το πλήθος
 * (Attachment.pages), για τους δείκτες ανακύκλωσης. Ένα αρχείο τη φορά, λίγα δευτερόλεπτα μετά την εκκίνηση.
 * Αρχεία όπου η μέτρηση απέτυχε σημειώνονται (localStorage) ώστε να μην ξαναδοκιμάζονται σε κάθε εκκίνηση.
 */
import { allItems, updateItem } from './library';
import { blobStore } from './blobs';
import { pdfPageCount } from '@/services/pdfPages';

const TRIED = 'manuals-pages-tried-v1';
const tried = (): Set<string> => { try { return new Set(JSON.parse(localStorage.getItem(TRIED) ?? '[]') as string[]); } catch { return new Set(); } };
const remember = (s: Set<string>) => { try { localStorage.setItem(TRIED, JSON.stringify([...s].slice(-2000))); } catch { /* χωρίς αποθήκευση */ } };

export function startPagesBackfill(delayMs = 4000): void {
  setTimeout(() => void run(), delayMs);
}

async function run(): Promise<void> {
  const skip = tried();
  for (const item of allItems()) {
    for (const a of item.attachments) {
      if (a.kind !== 'manual' || a.mime !== 'application/pdf' || a.pages || skip.has(a.id)) continue;
      const blob = await blobStore.get(a.blobId).catch(() => null);
      const pages = blob ? await pdfPageCount(blob) : undefined;
      if (!pages) { skip.add(a.id); remember(skip); continue; }
      await updateItem(item.id, (c) => ({ ...c, attachments: c.attachments.map((x) => (x.id === a.id ? { ...x, pages } : x)) })).catch(() => {});
    }
  }
}
