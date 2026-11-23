/**
 * Το κλειδί κρυπτογράφησης των δεδομένων αυτής της συσκευής, και η απόφαση στην εκκίνηση:
 *  - iOS: 32 τυχαία bytes στο Keychain, ΜΟΝΟ γι' αυτή τη συσκευή (δεν συγχρονίζονται): κάθε συσκευή (iPhone, iPad)
 *    έχει δικό της κλειδί, και η διαγραφή σε μία δεν κλειδώνει την άλλη. Τα δεδομένα ταξιδεύουν μεταξύ συσκευών με τον
 *    συγχρονισμό iCloud ή το αντίγραφο ασφαλείας, όχι με το κλειδί.
 *  - web / προεπισκόπηση: μη εξαγώγιμο CryptoKey σε χωριστή βάση IndexedDB. Προστατεύει λιγότερο (το κλειδί είναι στον
 *    ίδιο browser με τα δεδομένα)· υπάρχει για να τρέχει παντού ο ίδιος κώδικας.
 * Fail-closed: αν υπάρχουν κρυπτογραφημένα δεδομένα αλλά όχι κλειδί που να τα ανοίγει, η εφαρμογή δεν γράφει τίποτα
 * (κατάσταση «locked») μέχρι να αποφασίσει ο χρήστης.
 */
import { generateKey, importRawKey, isSealed, openBlob, openItem, sealBlob, sealItem, type SealedBlob, type SealedItem } from './codec';
import { deleteKeychainKey, keychainAvailable, keychainKey } from '@/services/deviceSecurity';
import * as idb from './idb';

let key: CryptoKey | null = null;

/** Το κλειδί (μόνο μετά από openVault() === 'ready'). */
export function vaultKey(): CryptoKey {
  if (!key) throw new Error('vault locked');
  return key;
}

// ---------- κλειδί web ----------
function keysDb(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open('manuals-keys', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('k');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
const req = <T>(r: IDBRequest<T>) => new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function webKey(create: boolean): Promise<CryptoKey | null> {
  const db = await keysDb();
  const got = await req(db.transaction('k').objectStore('k').get('storage') as IDBRequest<CryptoKey | undefined>);
  if (got || !create) return got ?? null;
  const k = await generateKey();
  await req(db.transaction('k', 'readwrite').objectStore('k').put(k, 'storage'));
  return k;
}
async function deleteWebKey() {
  const db = await keysDb();
  await req(db.transaction('k', 'readwrite').objectStore('k').delete('storage'));
}

async function loadKey(create: boolean): Promise<CryptoKey | null> {
  if (keychainAvailable) { const raw = await keychainKey(create); return raw ? importRawKey(raw) : null; }
  try { return await webKey(create); } catch { return null; }
}

/**
 * Μετάβαση κλειδιού web → Keychain. Συμβαίνει όταν τα δεδομένα γράφτηκαν με κλειδί web μέσα στην εφαρμογή iOS (π.χ. τα
 * plugins Swift δεν ήταν διαθέσιμα σε κάποια έκδοση) και τώρα υπάρχει Keychain. Κάθε εγγραφή που ΔΕΝ ανοίγει με το νέο
 * κλειδί ανοίγει με το παλιό και ξανακλειδώνεται με το νέο. Είναι επαναλήψιμη: αν διακοπεί, η επόμενη εκκίνηση συνεχίζει
 * από εκεί που έμεινε, γιατί το κλειδί web σβήνεται ΜΟΝΟ όταν τελειώσουν όλες οι εγγραφές.
 */
async function rekey(from: CryptoKey, to: CryptoKey): Promise<void> {
  const items = (await idb.getAll<unknown>('items')).filter(isSealed) as SealedItem[];
  const put: { value: unknown }[] = [];
  for (const rec of items) {
    try { await openItem(to, rec); continue; } catch { /* όχι ακόμη στο νέο κλειδί */ }
    put.push({ value: await sealItem(to, rec.id, await openItem(from, rec)) });
  }
  if (put.length) await idb.write('items', { put });
  for (const id of await idb.allKeys('blobs')) { // ένα-ένα: τα αρχεία μπορεί να είναι μεγάλα
    const rec = await idb.getOne<SealedBlob>('blobs', id);
    if (!rec || !isSealed(rec)) continue;
    try { await openBlob(to, id, rec); continue; } catch { /* όχι ακόμη στο νέο κλειδί */ }
    await idb.write('blobs', { put: [{ key: id, value: await sealBlob(to, id, await openBlob(from, id, rec)) }] });
  }
}

/** ready: όλα καλά · locked: υπάρχουν δεδομένα που δεν ανοίγουν · no-key: δεν δημιουργήθηκε κλειδί (π.χ. σφάλμα Keychain) */
export type VaultStatus = 'ready' | 'locked' | 'no-key';

/**
 * Εκκίνηση, πριν φορτωθεί η βιβλιοθήκη. Βρίσκει (ή δημιουργεί) το κλειδί και ελέγχει ότι ανοίγει ένα κρυπτογραφημένο
 * προϊόν και ένα αρχείο. Νέο κλειδί δημιουργείται ΜΟΝΟ όταν δεν υπάρχει κανένα κρυπτογραφημένο δεδομένο.
 */
export async function openVault(): Promise<VaultStatus> {
  const sealedNow = async () => {
    const [items, blob] = await Promise.all([idb.getAll<unknown>('items'), idb.firstEntry<unknown>('blobs')]);
    return { item: items.find(isSealed) as SealedItem | undefined, blob: blob && isSealed(blob.value) ? { key: blob.key, value: blob.value } : null };
  };
  let found = await sealedNow();
  const anySealed = !!found.item || !!found.blob;
  if (keychainAvailable && anySealed) {
    const web = await webKey(false).catch(() => null);
    if (web) {
      const raw = await keychainKey(true);
      if (!raw) { key = web; return 'ready'; } // χωρίς Keychain αυτή τη στιγμή: συνεχίζει με το κλειδί web, ξαναδοκιμάζει την επόμενη φορά
      try {
        await rekey(web, await importRawKey(raw));
        await deleteWebKey();
      } catch { key = null; return 'locked'; } // η επόμενη εκκίνηση συνεχίζει τη μετάβαση (το κλειδί web υπάρχει ακόμη)
      found = await sealedNow(); // ο έλεγχος πιο κάτω γίνεται πάνω στις ξανακρυπτογραφημένες εγγραφές
    }
  }
  key = await loadKey(!anySealed);
  if (!key) return anySealed ? 'locked' : 'no-key';
  try {
    if (found.item) await openItem(key, found.item);
    if (found.blob) await openBlob(key, found.blob.key, found.blob.value);
  } catch {
    key = null;
    return 'locked';
  }
  return 'ready';
}

/**
 * Ανάκτηση από «locked» ή «Διαγραφή όλων»: σβήνει τα δεδομένα αυτής της συσκευής ΚΑΙ το κλειδί της· στην επόμενη
 * εκκίνηση δημιουργείται νέο. Ό,τι υπάρχει στο iCloud δεν αγγίζεται.
 */
export async function destroyLocalData(): Promise<void> {
  await Promise.all([idb.clear('items'), idb.clear('blobs'), idb.clear('meta')]);
  key = null;
  if (keychainAvailable) await deleteKeychainKey(); else await deleteWebKey().catch(() => {});
}
