/**
 * Κρυπτογράφηση του αντιγράφου ασφαλείας με κωδικό του χρήστη.
 *
 * Μορφή αρχείου (όλα big-endian):
 *   MAGIC "MNLSBAK" (7) | έκδοση 1 (1) | επαναλήψεις PBKDF2 (4) | salt (16) | iv (12) | κρυπτοκείμενο AES-256-GCM
 * Κλειδί: PBKDF2-HMAC-SHA256(κωδικός, salt, 600.000) — η τιμή που συνιστά το OWASP Password Storage Cheat Sheet.
 * Η κεφαλίδα (MAGIC…iv) μπαίνει ως additional data: αλλαγή σε οποιοδήποτε byte της κάνει την αποκρυπτογράφηση να αποτύχει.
 * Λάθος κωδικός και αλλοιωμένο αρχείο δεν ξεχωρίζουν (το GCM απλώς δεν επαληθεύεται) — και τα δύο → 'bad-password'.
 */
export const PBKDF2_ITERATIONS = 600_000;
const MAGIC = new TextEncoder().encode('MNLSBAK');
const VERSION = 1;
const HEADER = MAGIC.length + 1 + 4 + 16 + 12;
/** όριο για αρχεία από άγνωστη πηγή: όχι λιγότερες από τις μισές επαναλήψεις, όχι τόσες που να «παγώνει» η συσκευή */
const MIN_ITER = 300_000, MAX_ITER = 5_000_000;

export class BackupCryptoError extends Error {
  constructor(public code: 'bad-password' | 'not-encrypted' | 'unsupported') { super(code); }
}

export const isEncryptedBackup = (bytes: Uint8Array): boolean =>
  bytes.length > HEADER && MAGIC.every((b, i) => bytes[i] === b);

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptBackup(plain: Uint8Array<ArrayBuffer>, password: string): Promise<Uint8Array<ArrayBuffer>> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const header = new Uint8Array(HEADER);
  header.set(MAGIC, 0);
  const view = new DataView(header.buffer);
  view.setUint8(MAGIC.length, VERSION);
  view.setUint32(MAGIC.length + 1, PBKDF2_ITERATIONS);
  header.set(salt, MAGIC.length + 5);
  header.set(iv, MAGIC.length + 21);
  const key = await deriveKey(password, salt, PBKDF2_ITERATIONS);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: header }, key, plain));
  const out = new Uint8Array(HEADER + ct.length);
  out.set(header, 0);
  out.set(ct, HEADER);
  return out;
}

export async function decryptBackup(bytes: Uint8Array<ArrayBuffer>, password: string): Promise<Uint8Array<ArrayBuffer>> {
  if (!isEncryptedBackup(bytes)) throw new BackupCryptoError('not-encrypted');
  const view = new DataView(bytes.buffer, bytes.byteOffset, HEADER);
  if (view.getUint8(MAGIC.length) !== VERSION) throw new BackupCryptoError('unsupported');
  const iterations = view.getUint32(MAGIC.length + 1);
  if (iterations < MIN_ITER || iterations > MAX_ITER) throw new BackupCryptoError('unsupported');
  const header = bytes.slice(0, HEADER);
  const salt = header.slice(MAGIC.length + 5, MAGIC.length + 21);
  const iv = header.slice(MAGIC.length + 21, HEADER);
  const key = await deriveKey(password, salt, iterations);
  try {
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: header }, key, bytes.subarray(HEADER)));
  } catch { throw new BackupCryptoError('bad-password'); }
}
