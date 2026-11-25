/**
 * Αναζήτηση του εγχειριδίου στο Safari μέσα στην εφαρμογή iOS, με την ενέργεια «Αποθήκευση στο προϊόν» στην Κοινοποίηση
 * (ios/App/App/ManualBrowserPlugin.swift). Επιστρέφει τη διεύθυνση που αποθήκευσε ο χρήστης· το κατέβασμα το κάνει ο
 * καλών (services/download). Η εφαρμογή δεν βλέπει τι άλλο έκανε ο χρήστης στο Safari.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { closeScreensOnBackground } from './nativeScreens';

interface ManualBrowserPlugin {
  open(o: { url: string; actionTitle: string; closeOnBackground: boolean }): Promise<{ url: string | null }>;
}
// τα plugins του Capacitor είναι Proxy που «απαντούν» και σε `then`: δηλώνονται στο επίπεδο του module, όχι μέσα σε Promise
const ManualBrowser = registerPlugin<ManualBrowserPlugin>('ManualBrowser');

export const manualBrowserAvailable = Capacitor.getPlatform() === 'ios' && Capacitor.isPluginAvailable('ManualBrowser');

/** Ανοίγει τη σελίδα· η διεύθυνση που αποθήκευσε ο χρήστης, ή null αν έκλεισε το Safari. */
export async function searchManual(url: string, actionTitle: string): Promise<string | null> {
  const r = await ManualBrowser.open({ url, actionTitle, closeOnBackground: closeScreensOnBackground() });
  return r.url;
}
