/**
 * Ασφάλεια συσκευής στην εφαρμογή iOS: κλειδί κρυπτογράφησης στο Keychain και Face ID / Touch ID.
 * Γέφυρα προς τα plugins ios/App/App/SecureKeyPlugin.swift και BiometricPlugin.swift. Στο web δεν υπάρχουν:
 * οι συναρτήσεις δίνουν «δεν υποστηρίζεται» και ο καλών χρησιμοποιεί την εναλλακτική του.
 * ΣΗΜ.: ο κώδικας Swift δεν έχει μεταγλωττιστεί ούτε τρέξει ακόμη σε συσκευή.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { clearAppSwitch, expectAppSwitch } from './appSwitch';

const onIos = Capacitor.getPlatform() === 'ios';

interface SecureKeyPlugin {
  storageKey(o: { create: boolean }): Promise<{ key: string | null }>;
  deleteStorageKey(): Promise<{ ok: boolean }>;
}
interface BiometricPlugin {
  info(): Promise<{ available: boolean; type: 'faceID' | 'touchID' | 'opticID' | 'none' }>;
  authenticate(o: { reason: string }): Promise<{ ok: boolean }>;
}
// τα plugins του Capacitor είναι Proxy που «απαντούν» και σε `then`: δηλώνονται στο επίπεδο του module, όχι μέσα σε Promise
const SecureKey = registerPlugin<SecureKeyPlugin>('SecureKey');
const Biometric = registerPlugin<BiometricPlugin>('Biometric');

/**
 * Διάγνωση για τις Ρυθμίσεις: πλατφόρμα κατά το Capacitor και τα native plugins που δήλωσε η εφαρμογή iOS στη σελίδα
 * (window.Capacitor.PluginHeaders). Αν λείπουν τα SecureKey/Biometric, δεν φτάνουν στη σελίδα τα δικά μας plugins Swift.
 */
export function nativeDiagnostics(): { platform: string; plugins: string[] } {
  const headers = (globalThis as { Capacitor?: { PluginHeaders?: { name: string }[] } }).Capacitor?.PluginHeaders ?? [];
  return { platform: Capacitor.getPlatform(), plugins: headers.map((h) => h.name).sort() };
}

/** Υπάρχει Keychain (εφαρμογή iOS με το plugin); */
export const keychainAvailable = onIos && Capacitor.isPluginAvailable('SecureKey');

/** Τα 32 bytes του κλειδιού από το Keychain· με create=true δημιουργείται αν λείπει. null: δεν υπάρχει / σφάλμα. */
export async function keychainKey(create: boolean): Promise<Uint8Array<ArrayBuffer> | null> {
  if (!keychainAvailable) return null;
  try {
    const { key } = await SecureKey.storageKey({ create });
    if (!key) return null;
    const bytes = Uint8Array.from(atob(key), (c) => c.charCodeAt(0));
    return bytes.length === 32 ? bytes : null;
  } catch { return null; }
}
export async function deleteKeychainKey(): Promise<void> {
  if (!keychainAvailable) return;
  try { await SecureKey.deleteStorageKey(); } catch { /* χωρίς κλειδί: τίποτα να σβηστεί */ }
}

export const biometricSupported = onIos && Capacitor.isPluginAvailable('Biometric');

/** Τι προσφέρει η συσκευή: label για την οθόνη («Face ID», «Touch ID», ή κωδικός συσκευής). */
export async function biometricInfo(): Promise<{ available: boolean; label: string }> {
  if (!biometricSupported) return { available: false, label: '' };
  try {
    const i = await Biometric.info();
    const label = i.type === 'faceID' ? 'Face ID' : i.type === 'touchID' ? 'Touch ID' : i.type === 'opticID' ? 'Optic ID' : '';
    return { available: i.available, label };
  } catch { return { available: false, label: '' }; }
}

/** Ζητά Face ID (ή κωδικό συσκευής). true μόνο αν πέτυχε· ακύρωση ή σφάλμα → false. */
export async function biometricAuth(reason: string): Promise<boolean> {
  if (!biometricSupported) return false;
  expectAppSwitch(); // το παράθυρο του Face ID / του κωδικού δεν μετρά ως έξοδος από την εφαρμογή
  try { return (await Biometric.authenticate({ reason })).ok; } catch { return false; } finally { clearAppSwitch(); }
}
