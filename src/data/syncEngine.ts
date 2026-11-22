/**
 * Μηχανή συγχρονισμού: φέρνει τη βιβλιοθήκη αυτής της συσκευής και τον πάροχο στην ίδια κατάσταση. Δεν ξέρει τίποτα για
 * iCloud, IndexedDB ή οθόνη — όλα της δίνονται (πάροχος, βιβλιοθήκη, αρχεία, μνήμη), ώστε να δοκιμάζεται με ψεύτικα.
 *
 * Ένας κύκλος:
 *  1. ΚΑΤΕΒΑΣΜΑ αλλαγών από το τελευταίο σημάδι → συγχώνευση με τον κανόνα του domain/merge.
 *  2. ΑΡΧΕΙΑ που αναφέρουν τα προϊόντα και λείπουν από τη συσκευή → κατέβασμα.
 *  3. ΑΝΕΒΑΣΜΑ όσων προϊόντων διαφέρουν από ό,τι ξέρουμε ότι έχει ο πάροχος — πρώτα τα αρχεία τους, μετά τα στοιχεία,
 *     ώστε καμία συσκευή να μη δει προϊόν που δείχνει σε αρχείο που δεν έχει ανέβει.
 *  4. ΚΑΘΑΡΙΣΜΑ αρχείων στον πάροχο που δεν ανήκουν πια σε κανένα προϊόν.
 *
 * Σύγκλιση: όταν μια εισερχόμενη εκδοχή ΧΑΝΕΙ από την τοπική, το προϊόν μένει «προς ανέβασμα» και η τοπική εκδοχή
 * ξαναστέλνεται — έτσι ο πάροχος καταλήγει πάντα στη νικήτρια, όποια συσκευή κι αν έγραψε τελευταία.
 */
import { itemSchema, type Item } from '@/domain/model';
import { blobMimes, referencedBlobs, sameItem } from '@/domain/merge';
import { SyncError, type SyncMemo, type SyncProvider } from './sync';

export interface LocalLibrary {
  /** όλα τα προϊόντα, μαζί με ταφόπλακες */
  items(): Item[];
  /** συγχώνευση εισερχόμενων με τον κανόνα του domain/merge (και καθάρισμα τοπικών αρχείων που δεν χρειάζονται πια) */
  merge(incoming: Item[]): Promise<unknown>;
}
export interface LocalBlobs {
  put(id: string, blob: Blob): Promise<void>;
  get(id: string): Promise<Blob | null>;
  keys(): Promise<string[]>;
}
export interface MemoStore { load(): Promise<SyncMemo>; save(m: SyncMemo): Promise<void> }

export interface SyncDeps {
  provider: SyncProvider; library: LocalLibrary; blobs: LocalBlobs; memo: MemoStore; now?: () => number;
  /** αρχεία μεγαλύτερα από αυτό δεν ανεβαίνουν (μένουν μόνο στη συσκευή που τα έχει)· χωρίς τιμή, κανένα όριο */
  maxBlobBytes?: number;
}

/** Πόσα προϊόντα ανά αίτημα ανεβάσματος και πόσα bytes στοιχείων (τα όρια του παρόχου είναι μεγαλύτερα — βλ. services/icloud). */
const PUSH_MAX_ITEMS = 50;
const PUSH_MAX_BYTES = 500_000;

export function pushBatches(items: Item[]): Item[][] {
  const out: Item[][] = [];
  let cur: Item[] = [], size = 0;
  for (const i of items) {
    const bytes = JSON.stringify(i).length;
    if (cur.length && (cur.length >= PUSH_MAX_ITEMS || size + bytes > PUSH_MAX_BYTES)) { out.push(cur); cur = []; size = 0; }
    cur.push(i);
    size += bytes;
  }
  if (cur.length) out.push(cur);
  return out;
}

export interface SyncReport { pulled: number; pushed: number; blobsDown: number; blobsUp: number; blobsRemoved: number; blobsTooBig: number }

/** Ένας πλήρης κύκλος. Πετά SyncError· ό,τι ολοκληρώθηκε πριν από το σφάλμα έχει ήδη αποθηκευτεί στη μνήμη. */
export async function syncOnce({ provider, library, blobs, memo: store, now = Date.now, maxBlobBytes = Infinity }: SyncDeps): Promise<SyncReport> {
  const memo = await store.load();
  const report: SyncReport = { pulled: 0, pushed: 0, blobsDown: 0, blobsUp: 0, blobsRemoved: 0, blobsTooBig: 0 };
  if (!(await provider.available())) throw new SyncError('no-account');
  const uploaded = new Set(memo.uploaded);
  const save = () => store.save({ ...memo, uploaded: [...uploaded] });

  // 1. κατέβασμα
  let expiredOnce = false;
  for (;;) {
    let page;
    try { page = await provider.pull(memo.cursor); }
    catch (e) {
      // ληγμένο σημάδι: μία φορά από την αρχή (η συγχώνευση αντέχει να ξαναδεί τα ίδια)
      if (e instanceof SyncError && e.code === 'cursor-expired' && !expiredOnce) { expiredOnce = true; memo.cursor = null; continue; }
      throw e;
    }
    // ό,τι έρχεται από τον πάροχο είναι ανέλεγκτο: περνά από το σχήμα, τα άκυρα αγνοούνται
    const incoming = page.items.flatMap((raw) => { const p = itemSchema.safeParse(raw); return p.success ? [p.data] : []; });
    if (incoming.length) {
      await library.merge(incoming);
      const local = new Map(library.items().map((i) => [i.id, i]));
      for (const inc of incoming) {
        const cur = local.get(inc.id);
        // ίδια εκδοχή εδώ και στον πάροχο → τίποτα να σταλεί· αλλιώς (κέρδισε η τοπική) μένει προς ανέβασμα
        if (cur && sameItem(cur, inc)) { memo.pushed[inc.id] = inc.updatedAt; continue; }
        delete memo.pushed[inc.id];
        // η άλλη συσκευή μπορεί να έχει ήδη σβήσει από τον πάροχο αρχεία που η νικήτρια εκδοχή κρατά: ξανανεβαίνουν
        if (cur) for (const id of referencedBlobs([cur])) uploaded.delete(id);
      }
      report.pulled += incoming.length;
    }
    memo.cursor = page.cursor;
    await save();
    if (!page.more) break;
  }

  // 2. αρχεία που λείπουν από τη συσκευή
  const have = new Set(await blobs.keys());
  const mimes = blobMimes(library.items());
  for (const id of referencedBlobs(library.items())) {
    if (have.has(id)) continue;
    const b = await provider.getBlob(id);
    if (!b) continue; // δεν έχει ανέβει ακόμη από την άλλη συσκευή: στον επόμενο κύκλο
    await blobs.put(id, new Blob([b], { type: mimes.get(id) ?? '' }));
    have.add(id);
    uploaded.add(id);
    report.blobsDown++;
  }
  await save();

  // 3. ανέβασμα
  const dirty = library.items().filter((i) => memo.pushed[i.id] !== i.updatedAt);
  for (const batch of pushBatches(dirty)) {
    for (const id of referencedBlobs(batch)) {
      if (uploaded.has(id)) continue;
      const b = await blobs.get(id);
      if (!b) continue;
      if (b.size > maxBlobBytes) { report.blobsTooBig++; continue; }
      await provider.putBlob(id, b);
      uploaded.add(id);
      report.blobsUp++;
      await save();
    }
    await provider.push(batch);
    for (const i of batch) memo.pushed[i.id] = i.updatedAt;
    report.pushed += batch.length;
    await save();
  }

  // 4. αρχεία του παρόχου που δεν ανήκουν πια σε κανένα προϊόν
  const used = referencedBlobs(library.items());
  const orphans = [...uploaded].filter((id) => !used.has(id));
  if (orphans.length) {
    await provider.removeBlobs(orphans);
    for (const id of orphans) uploaded.delete(id);
    report.blobsRemoved = orphans.length;
  }

  memo.lastSync = now();
  await save();
  return report;
}
