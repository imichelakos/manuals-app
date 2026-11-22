/**
 * Επεξεργασία εικόνας στη συσκευή: σμίκρυνση + JPEG (για αποθήκευση και OCR) και μικρογραφία (για τη λίστα).
 * Φόρτωση μέσω <img>: ο browser εφαρμόζει μόνος του τον προσανατολισμό EXIF της φωτογραφίας.
 */
const MAX_PIXELS = 80_000_000; // φωτογραφία πάνω από ~80 MP δεν αποκωδικοποιείται (προστασία μνήμης)

export class ImageError extends Error {}

async function load(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || img.naturalWidth * img.naturalHeight > MAX_PIXELS) throw new ImageError('size');
    return img;
  } catch (e) {
    throw e instanceof ImageError ? e : new ImageError('decode');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function draw(img: HTMLImageElement, maxSide: number): HTMLCanvasElement {
  const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * k));
  c.height = Math.max(1, Math.round(img.naturalHeight * k));
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff'; // διαφανές PNG → λευκό φόντο στο JPEG
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

const toBlob = (c: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new ImageError('encode'))), 'image/jpeg', quality));

export interface Prepared { full: Blob; thumb: Blob; canvas: HTMLCanvasElement }

/** Εικόνα έτοιμη για αποθήκευση: JPEG με μεγάλη πλευρά ≤ 2000 px (αρκετό για OCR και ανάγνωση), + μικρογραφία 320 px. */
export async function prepareImage(blob: Blob): Promise<Prepared> {
  const img = await load(blob);
  const canvas = draw(img, 2000);
  return { canvas, full: await toBlob(canvas, 0.82), thumb: await toBlob(draw(img, 320), 0.7) };
}
