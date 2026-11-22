/**
 * Λεπτό περιτύλιγμα του IndexedDB (υποσχέσεις αντί για events). Τρία «συρτάρια»:
 *  - items: τα προϊόντα (κλειδί: id)
 *  - blobs: τα bytes των αρχείων (κλειδί: blobId) — ως ArrayBuffer + τύπος, που αποθηκεύεται αξιόπιστα παντού
 *  - meta:  μικρές τιμές της συσκευής (π.χ. αναγνωριστικό συσκευής για τον συγχρονισμό)
 */
const NAME = 'manuals-v1';
export type StoreName = 'items' | 'blobs' | 'meta';

let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  return (dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open(NAME, 1);
    r.onupgradeneeded = () => {
      r.result.createObjectStore('items', { keyPath: 'id' });
      r.result.createObjectStore('blobs');
      r.result.createObjectStore('meta');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => { dbp = null; rej(r.error ?? new Error('indexedDB')); };
  }));
}

const req = <T>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const done = (tx: IDBTransaction) => new Promise<void>((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error ?? new Error('aborted')); });

export async function getAll<T>(store: StoreName): Promise<T[]> {
  return req((await db()).transaction(store).objectStore(store).getAll() as IDBRequest<T[]>);
}
export async function getOne<T>(store: StoreName, key: string): Promise<T | undefined> {
  return req((await db()).transaction(store).objectStore(store).get(key) as IDBRequest<T | undefined>);
}
export async function allKeys(store: StoreName): Promise<string[]> {
  return (await req((await db()).transaction(store).objectStore(store).getAllKeys())).map(String);
}
/** Εγγραφές και διαγραφές σε ΜΙΑ συναλλαγή: ή γίνονται όλες ή καμία. Με κλειδί όταν το συρτάρι δεν έχει keyPath. */
export async function write(store: StoreName, ops: { put?: { value: unknown; key?: string }[]; del?: string[] }): Promise<void> {
  const tx = (await db()).transaction(store, 'readwrite');
  const os = tx.objectStore(store);
  for (const p of ops.put ?? []) if (p.key === undefined) os.put(p.value); else os.put(p.value, p.key);
  for (const k of ops.del ?? []) os.delete(k);
  await done(tx);
}
export async function clear(store: StoreName): Promise<void> {
  const tx = (await db()).transaction(store, 'readwrite');
  tx.objectStore(store).clear();
  await done(tx);
}
