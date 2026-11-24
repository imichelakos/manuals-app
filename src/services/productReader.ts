/**
 * Αναγνώριση προϊόντος στη συσκευή, χωρίς λίστα μαρκών (ios/App/App/ProductReaderPlugin.swift): το OCR της Apple
 * (Vision) με το μέγεθος κάθε γραμμής, και όπου υπάρχει το μοντέλο της Apple (Foundation Models, iOS 26+ με Apple
 * Intelligence) μάρκα / μοντέλο / είδος. Πρωτότυπο για μέτρηση: Διάγνωση + «Δοκιμή αναγνώρισης» στο «Για δοκιμές».
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { toBase64 } from './base64';

export interface ProductReaderStatus { ios: string; device: string; xcode: string; sdk: string; ai: string }
export interface ReadLine { text: string; size: number; top: number }
export interface ProductRead { lines: ReadLine[]; ocrMs: number; ai: { brand: string; model: string; kind: string } | null; aiMs: number; aiStatus: string; aiError: string | null }

interface ProductReaderPlugin {
  status(): Promise<ProductReaderStatus>;
  read(o: { image: string }): Promise<ProductRead>;
}
// τα plugins του Capacitor είναι Proxy που «απαντούν» και σε `then`: δηλώνονται στο επίπεδο του module, όχι μέσα σε Promise
const ProductReader = registerPlugin<ProductReaderPlugin>('ProductReader');

export const productReaderAvailable = Capacitor.getPlatform() === 'ios' && Capacitor.isPluginAvailable('ProductReader');

/** null: όχι στην εφαρμογή iOS ή παλιό build χωρίς το plugin */
export async function productReaderStatus(): Promise<ProductReaderStatus | null> {
  if (!productReaderAvailable) return null;
  try { return await ProductReader.status(); } catch { return null; }
}

export async function readProduct(image: Blob): Promise<ProductRead> {
  return ProductReader.read({ image: await toBase64(image) });
}
