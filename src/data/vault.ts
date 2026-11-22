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
import { generateKey, importRawKey, isSealed, openBlob, openItem, type SealedItem } from './codec';
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

/** ready: όλα καλά · locked: υπάρχουν δεδομένα που δεν ανοίγουν · no-key: δεν δημιουργήθηκε κλειδί (π.χ. σφάλμα Keychain) */
export type VaultStatus = 'ready' | 'locked' | 'no-key';

/**
 * Εκκίνηση, πριν φορτωθεί η βιβλιοθήκη. Βρίσκει (ή δημιουργεί) το κλειδί και ελέγχει ότι ανοίγει ένα κρυπτογραφημένο
 * προϊόν και ένα αρχείο. Νέο κλειδί δημιουργείται ΜΟΝΟ όταν δεν υπάρχει κανένα κρυπτογραφημένο δεδομένο.
 */
export async function openVault(): Promise<VaultStatus> {
  const [items, blob] = await Promise.all([idb.getAll<unknown>('items'), idb.firstEntry<unknown>('blobs')]);
  const sealedItem = items.find(isSealed) as SealedItem | undefined;
  const sealedBlob = blob && isSealed(blob.value) ? blob : null;
  const anySealed = !!sealedItem || !!sealedBlob;
  key = await loadKey(!anySealed);
  if (!key) return anySealed ? 'locked' : 'no-key';
  try {
    if (sealedItem) await openItem(key, sealedItem);
    if (sealedBlob && isSealed(sealedBlob.value)) await openBlob(key, sealedBlob.key, sealedBlob.value);
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
