/** Σελίδες ενός αποθηκευμένου PDF (domain/pdfPages) με αποσυμπίεση από το fflate, φορτωμένο μόνο όταν χρειαστεί. */
import { countPdfPages } from '@/domain/pdfPages';

export async function pdfPageCount(blob: Blob): Promise<number | undefined> {
  try {
    const { unzlibSync } = await import('fflate');
    // ανοχή σε περιττά bytes στο τέλος του stream (\r\n πριν το endstream)
    const inflate = (b: Uint8Array) => { try { return unzlibSync(b); } catch { return unzlibSync(b.subarray(0, b.length - 2)); } };
    return countPdfPages(new Uint8Array(await blob.arrayBuffer()), inflate) ?? undefined;
  } catch { return undefined; }
}
