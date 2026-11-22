/**
 * Κρυπτογράφηση εγγραφών του IndexedDB (AES-256-GCM, Web Crypto). Καθαρές συναρτήσεις: παίρνουν το κλειδί ως όρισμα,
 * ώστε να δοκιμάζονται χωρίς συσκευή (tests/codec.test.ts). Το κλειδί το δίνει το data/vault.
 *
 * Κάθε εγγραφή έχει δικό της τυχαίο IV (96 bit) και «πρόσθετα δεδομένα» (AAD) το είδος και το id της: μια
 * κρυπτογραφημένη τιμή δεν μπορεί να μεταφερθεί σε άλλη εγγραφή χωρίς να αποτύχει η αποκρυπτογράφηση.
 *  - προϊόν:  { id, iv, ct }   ct = JSON του προϊόντος          AAD «item:<id>»
 *  - αρχείο:  { iv, ct }       ct = [μήκος τύπου 2 bytes][τύπος][bytes]   AAD «blob:<id>»
 * Ο τύπος (MIME) του αρχείου κρυπτογραφείται κι αυτός· φαίνεται μόνο το μέγεθος.
 */
export interface SealedItem { id: string; iv: Uint8Array; ct: ArrayBuffer }
export interface SealedBlob { iv: Uint8Array; ct: ArrayBuffer }

const te = new TextEncoder(), td = new TextDecoder();
const aad = (kind: 'item' | 'blob', id: string) => te.encode(`${kind}:${id}`);
const newIv = () => crypto.getRandomValues(new Uint8Array(12));

async function seal(key: CryptoKey, data: Uint8Array<ArrayBuffer>, additionalData: Uint8Array<ArrayBuffer>) {
  const iv = newIv();
  return { iv, ct: await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData }, key, data) };
}
const open = (key: CryptoKey, iv: Uint8Array, ct: ArrayBuffer, additionalData: Uint8Array<ArrayBuffer>) =>
  crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv), additionalData }, key, ct);

/** Είναι κρυπτογραφημένη εγγραφή (και όχι παλιά απλή, από πριν την κρυπτογράφηση); */
export function isSealed(v: unknown): v is SealedBlob {
  const r = v as Partial<SealedBlob> | null;
  return !!r && typeof r === 'object' && r.iv instanceof Uint8Array && r.iv.length === 12 && r.ct instanceof ArrayBuffer;
}

export async function sealItem(key: CryptoKey, id: string, item: unknown): Promise<SealedItem> {
  return { id, ...(await seal(key, te.encode(JSON.stringify(item)), aad('item', id))) };
}
/** Το προϊόν όπως ήταν (ανέλεγκτο: ο καλών το περνά από το σχήμα). Πετά σφάλμα αν το κλειδί ή η εγγραφή δεν ταιριάζουν. */
export async function openItem(key: CryptoKey, rec: SealedItem): Promise<unknown> {
  return JSON.parse(td.decode(await open(key, rec.iv, rec.ct, aad('item', rec.id))));
}

export async function sealBlob(key: CryptoKey, id: string, blob: Blob): Promise<SealedBlob> {
  const mime = te.encode(blob.type.slice(0, 200));
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const plain = new Uint8Array(2 + mime.length + bytes.length);
  plain[0] = mime.length >> 8; plain[1] = mime.length & 0xff;
  plain.set(mime, 2);
  plain.set(bytes, 2 + mime.length);
  return seal(key, plain, aad('blob', id));
}
export async function openBlob(key: CryptoKey, id: string, rec: SealedBlob): Promise<Blob> {
  const plain = new Uint8Array(await open(key, rec.iv, rec.ct, aad('blob', id)));
  const n = (plain[0]! << 8) | plain[1]!;
  return new Blob([plain.subarray(2 + n)], { type: td.decode(plain.subarray(2, 2 + n)) });
}

/** Νέο κλειδί για το web (μη εξαγώγιμο: ο κώδικας της σελίδας δεν μπορεί να διαβάσει τα bytes του). */
export const generateKey = () => crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
/** Κλειδί από 32 bytes (π.χ. από το Keychain του iOS), μη εξαγώγιμο. */
export const importRawKey = (raw: Uint8Array<ArrayBuffer>) => crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
