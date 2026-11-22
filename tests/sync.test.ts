import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyItem, itemSchema, newId, type Item } from '@/domain/model';
import { mergeItems, referencedBlobs } from '@/domain/merge';
import { EMPTY_MEMO, SyncError, type SyncMemo, type SyncProvider } from '@/data/sync';
import { pushBatches, syncOnce, type SyncDeps } from '@/data/syncEngine';

/** Ψεύτικο «cloud»: εγγραφές με αύξοντα αριθμό αλλαγής (το σημάδι), αρχεία, και διακόπτες βλάβης. */
class Cloud {
  items = new Map<string, { raw: unknown; seq: number }>();
  blobs = new Map<string, Blob>();
  seq = 0;
  page = 100;
  expireBelow = 0;
  account = true;
  failPush = 0;
  calls = { putBlob: 0, push: 0 };
  provider(): SyncProvider {
    return {
      available: async () => this.account,
      pull: async (cursor) => {
        const since = cursor === null ? 0 : Number(cursor);
        if (cursor !== null && since < this.expireBelow) throw new SyncError('cursor-expired');
        const changed = [...this.items.values()].filter((r) => r.seq > since).sort((a, b) => a.seq - b.seq);
        const out = changed.slice(0, this.page);
        return { items: out.map((r) => r.raw), cursor: String(out.length ? out[out.length - 1]!.seq : since), more: changed.length > out.length };
      },
      push: async (items) => {
        this.calls.push++;
        if (this.failPush > 0) { this.failPush--; throw new SyncError('offline'); }
        for (const i of items) this.items.set(i.id, { raw: JSON.parse(JSON.stringify(i)), seq: ++this.seq });
      },
      putBlob: async (id, blob) => { this.calls.putBlob++; this.blobs.set(id, blob); },
      getBlob: async (id) => this.blobs.get(id) ?? null,
      removeBlobs: async (ids) => { for (const id of ids) this.blobs.delete(id); },
    };
  }
  item(id: string): Item { return itemSchema.parse(this.items.get(id)!.raw); }
}

/** Μια συσκευή: βιβλιοθήκη και αρχεία στη μνήμη, με την ίδια συμπεριφορά συγχώνευσης όπως το data/library. */
class Device {
  items: Item[] = [];
  blobs = new Map<string, Blob>();
  memo: SyncMemo = { ...EMPTY_MEMO, enabled: true };
  constructor(private cloud: Cloud) {}
  deps(): SyncDeps {
    return {
      provider: this.cloud.provider(),
      library: {
        items: () => this.items,
        merge: async (incoming) => {
          this.items = mergeItems(this.items, incoming).items;
          const used = referencedBlobs(this.items);
          for (const k of [...this.blobs.keys()]) if (!used.has(k)) this.blobs.delete(k);
        },
      },
      blobs: { put: async (id, b) => { this.blobs.set(id, b); }, get: async (id) => this.blobs.get(id) ?? null, keys: async () => [...this.blobs.keys()] },
      memo: { load: async () => structuredClone(this.memo), save: async (m) => { this.memo = structuredClone(m); } },
      now: () => 1_000_000,
    };
  }
  sync() { return syncOnce(this.deps()); }
  add(name: string, t: number, withFile = false): Item {
    let item = itemSchema.parse({ ...emptyItem(t), name });
    if (withFile) {
      const blobId = newId();
      this.blobs.set(blobId, new Blob([`pdf of ${name}`], { type: 'application/pdf' }));
      item = { ...item, attachments: [{ id: newId(), kind: 'manual', name: 'm.pdf', mime: 'application/pdf', size: 3, blobId, addedAt: t, origin: 'import' }] };
    }
    this.items = [...this.items, item];
    return item;
  }
  edit(id: string, patch: Partial<Item>, t: number) { this.items = this.items.map((i) => (i.id === id ? itemSchema.parse({ ...i, ...patch, updatedAt: t }) : i)); }
  remove(id: string, t: number) {
    const cur = this.get(id)!;
    for (const b of referencedBlobs([cur])) this.blobs.delete(b);
    this.items = this.items.map((i) => (i.id === id ? { ...emptyItem(i.createdAt), id, deleted: true, updatedAt: t } : i));
  }
  get(id: string) { return this.items.find((i) => i.id === id); }
  live() { return this.items.filter((i) => !i.deleted).map((i) => i.name).sort(); }
}
const pair = () => { const cloud = new Cloud(); return { cloud, a: new Device(cloud), b: new Device(cloud) }; };

test('sync: προϊόν με αρχείο φτάνει στην άλλη συσκευή', async () => {
  const { cloud, a, b } = pair();
  const x = a.add('Πλυντήριο', 10, true);
  const blobId = x.attachments[0]!.blobId;
  assert.deepEqual(await a.sync(), { pulled: 0, pushed: 1, blobsDown: 0, blobsUp: 1, blobsRemoved: 0, blobsTooBig: 0 });
  assert.deepEqual(await b.sync(), { pulled: 1, pushed: 0, blobsDown: 1, blobsUp: 0, blobsRemoved: 0, blobsTooBig: 0 });
  assert.deepEqual(b.live(), ['Πλυντήριο']);
  assert.equal(await b.blobs.get(blobId)!.text(), 'pdf of Πλυντήριο');
  assert.equal(b.blobs.get(blobId)!.type, 'application/pdf'); // ο τύπος έρχεται από τα στοιχεία του προϊόντος
  assert.equal(b.memo.lastSync, 1_000_000);
  // το Α ξαναβλέπει μία φορά τη δική του εγγραφή (όπως συμβαίνει και σε πραγματικό πάροχο) — και δεν την ξαναστέλνει
  assert.deepEqual(await a.sync(), { pulled: 1, pushed: 0, blobsDown: 0, blobsUp: 0, blobsRemoved: 0, blobsTooBig: 0 });
  // χωρίς αλλαγές: καμία κίνηση
  assert.deepEqual(await a.sync(), { pulled: 0, pushed: 0, blobsDown: 0, blobsUp: 0, blobsRemoved: 0, blobsTooBig: 0 });
  assert.deepEqual(await b.sync(), { pulled: 0, pushed: 0, blobsDown: 0, blobsUp: 0, blobsRemoved: 0, blobsTooBig: 0 });
  assert.equal(cloud.calls.putBlob, 1);
});

test('sync: ταυτόχρονες αλλαγές — κερδίζει η νεότερη, με όποια σειρά κι αν συγχρονίσουν', async () => {
  for (const order of ['ab', 'ba'] as const) {
    const { cloud, a, b } = pair();
    const x = a.add('Ψυγείο', 10);
    await a.sync(); await b.sync();
    a.edit(x.id, { notes: 'από το Α' }, 20);
    b.edit(x.id, { notes: 'από το Β' }, 30);
    const [first, second] = order === 'ab' ? [a, b] : [b, a];
    await first.sync(); await second.sync(); await first.sync(); await second.sync();
    assert.equal(a.get(x.id)!.notes, 'από το Β', order);
    assert.equal(b.get(x.id)!.notes, 'από το Β', order);
    assert.equal(cloud.item(x.id).notes, 'από το Β', order);
  }
});

test('sync: παλιότερη εκδοχή που «πάτησε» τη νεότερη στο cloud διορθώνεται', async () => {
  const { cloud, a, b } = pair();
  const x = a.add('Φούρνος', 10);
  await a.sync(); await b.sync();
  a.edit(x.id, { notes: 'νέο' }, 50);
  await a.sync();
  // κούρσα: μια συσκευή έγραψε την παλιά εκδοχή πάνω από τη νέα
  cloud.items.set(x.id, { raw: { ...b.get(x.id)!, notes: 'παλιό', updatedAt: 40 }, seq: ++cloud.seq });
  await a.sync();
  assert.equal(cloud.item(x.id).notes, 'νέο');
  await b.sync();
  assert.equal(b.get(x.id)!.notes, 'νέο');
});

test('sync: ίδια χρονική στιγμή, διαφορετικό περιεχόμενο — όλες οι συσκευές καταλήγουν στο ίδιο', async () => {
  const { cloud, a, b } = pair();
  const x = a.add('Τοστιέρα', 10);
  await a.sync(); await b.sync();
  a.edit(x.id, { room: 'Κουζίνα' }, 20);
  b.edit(x.id, { room: 'Αποθήκη' }, 20);
  await a.sync(); await b.sync(); await a.sync(); await b.sync();
  assert.equal(a.get(x.id)!.room, b.get(x.id)!.room);
  assert.equal(cloud.item(x.id).room, a.get(x.id)!.room);
});

test('sync: διαγραφή περνά στην άλλη συσκευή και καθαρίζει τα αρχεία παντού', async () => {
  const { cloud, a, b } = pair();
  const x = a.add('Σκούπα', 10, true);
  a.add('Σίδερο', 11);
  await a.sync(); await b.sync();
  assert.equal(cloud.blobs.size, 1);
  b.remove(x.id, 20);
  await b.sync();
  assert.equal(cloud.blobs.size, 0); // το Β (που το είχε κατεβάσει) το σβήνει από το cloud
  await a.sync();
  assert.deepEqual(a.live(), ['Σίδερο']);
  assert.equal(a.blobs.size, 0);
  assert.equal(a.get(x.id)!.deleted, true);
  // παλιότερη αλλαγή του Α στο διαγραμμένο δεν το «ανασταίνει»
  const { a: a2, b: b2 } = pair();
  const y = a2.add('Βραστήρας', 10);
  await a2.sync(); await b2.sync();
  a2.edit(y.id, { notes: 'κάτι' }, 15);
  b2.remove(y.id, 20);
  await b2.sync(); await a2.sync(); await b2.sync();
  assert.deepEqual([a2.live(), b2.live()], [[], []]);
});

test('sync: αφαίρεση συνημμένου σβήνει το αρχείο από το cloud', async () => {
  const { cloud, a, b } = pair();
  const x = a.add('Καφετιέρα', 10, true);
  await a.sync(); await b.sync();
  a.edit(x.id, { attachments: [] }, 20);
  a.blobs.clear();
  assert.equal((await a.sync()).blobsRemoved, 1);
  assert.equal(cloud.blobs.size, 0);
  await b.sync();
  assert.equal(b.blobs.size, 0);
});

test('sync: σύγκρουση όπου η νικήτρια εκδοχή κρατά αρχείο που η άλλη συσκευή έσβησε από το cloud', async () => {
  const { cloud, a, b } = pair();
  const x = a.add('Μίξερ', 10, true);
  const blobId = x.attachments[0]!.blobId;
  await a.sync(); await b.sync();
  b.edit(x.id, { attachments: [] }, 20);   // το Β αφαιρεί το αρχείο…
  b.blobs.clear();
  a.edit(x.id, { notes: 'σημείωση' }, 30); // …ενώ το Α (εκτός σύνδεσης) αλλάζει κάτι άλλο, αργότερα
  await b.sync();
  assert.equal(cloud.blobs.has(blobId), false);
  await a.sync();                           // κερδίζει το Α: το αρχείο πρέπει να ξαναβρεθεί στο cloud
  assert.equal(cloud.blobs.has(blobId), true);
  await b.sync();
  assert.equal(b.get(x.id)!.notes, 'σημείωση');
  assert.equal(await b.blobs.get(blobId)!.text(), 'pdf of Μίξερ');
});

test('sync: ληγμένο σημάδι αλλαγών → πλήρες κατέβασμα', async () => {
  const { cloud, a, b } = pair();
  a.add('Ένα', 10);
  await a.sync(); await b.sync();
  a.add('Δύο', 20);
  await a.sync();
  cloud.expireBelow = 100;
  await b.sync();
  assert.deepEqual(b.live(), ['Ένα', 'Δύο']); // σειρά κωδικών χαρακτήρων: «Έ» πριν από «Δ»
});

test('sync: άκυρη εγγραφή στο cloud αγνοείται, οι υπόλοιπες περνούν· κατέβασμα σε σελίδες', async () => {
  const { cloud, a, b } = pair();
  for (let i = 0; i < 7; i++) a.add(`Προϊόν ${i}`, 10 + i);
  await a.sync();
  cloud.items.set('bad', { raw: { id: '../etc', name: 42 }, seq: ++cloud.seq });
  cloud.items.set('worse', { raw: 'όχι αντικείμενο', seq: ++cloud.seq });
  cloud.page = 3;
  const r = await b.sync();
  assert.equal(r.pulled, 7);
  assert.equal(b.live().length, 7);
  assert.equal(r.pushed, 0); // τίποτα από όσα κατέβηκαν δεν ξαναστέλνεται
});

test('sync: διακοπή στο ανέβασμα — ο επόμενος κύκλος ολοκληρώνει, χωρίς διπλά ανεβάσματα αρχείων', async () => {
  const { cloud, a, b } = pair();
  a.add('Στεγνωτήριο', 10, true);
  cloud.failPush = 1;
  await assert.rejects(a.sync(), (e) => e instanceof SyncError && e.code === 'offline');
  assert.equal(cloud.items.size, 0);
  assert.equal(a.memo.lastSync, null);
  assert.equal((await a.sync()).pushed, 1);
  assert.equal(cloud.calls.putBlob, 1); // το αρχείο είχε ανέβει στην πρώτη προσπάθεια και δεν ξανανέβηκε
  await b.sync();
  assert.deepEqual(b.live(), ['Στεγνωτήριο']);
});

test('sync: χωρίς λογαριασμό δεν γίνεται τίποτα', async () => {
  const { cloud, a } = pair();
  a.add('Κάτι', 10);
  cloud.account = false;
  await assert.rejects(a.sync(), (e) => e instanceof SyncError && e.code === 'no-account');
  assert.equal(cloud.items.size, 0);
});

test('sync: πρώτος συγχρονισμός συσκευής που έχει ήδη δικά της δεδομένα', async () => {
  const { a, b } = pair();
  a.add('Του Α', 10);
  b.add('Του Β', 12, true);
  await a.sync(); await b.sync(); await a.sync();
  assert.deepEqual(a.live(), ['Του Α', 'Του Β']);
  assert.deepEqual(b.live(), ['Του Α', 'Του Β']);
  assert.equal(a.blobs.size, 1);
});

test('sync: αρχείο πάνω από το όριο μένει μόνο στη συσκευή του, το προϊόν συγχρονίζεται', async () => {
  const { cloud, a, b } = pair();
  a.add('Με μεγάλο αρχείο', 10, true);
  const r = await syncOnce({ ...a.deps(), maxBlobBytes: 5 });
  assert.deepEqual([r.pushed, r.blobsUp, r.blobsTooBig], [1, 0, 1]);
  assert.equal(cloud.blobs.size, 0);
  await b.sync();
  assert.deepEqual(b.live(), ['Με μεγάλο αρχείο']);
  assert.equal(b.blobs.size, 0);
});

test('pushBatches: όρια πλήθους και μεγέθους', () => {
  const small = Array.from({ length: 120 }, (_, i) => itemSchema.parse({ ...emptyItem(i), name: `n${i}` }));
  assert.deepEqual(pushBatches(small).map((b) => b.length), [50, 50, 20]);
  const big = Array.from({ length: 5 }, (_, i) => itemSchema.parse({ ...emptyItem(i), notes: 'x'.repeat(19_000), ocrText: 'y'.repeat(19_000) }));
  assert.ok(pushBatches([...big, ...big, ...big, ...big]).length > 1);
  assert.deepEqual(pushBatches([]), []);
});
