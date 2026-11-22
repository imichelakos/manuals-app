/**
 * Ανάγνωση κειμένου από εικόνα στη συσκευή (Tesseract) — η εικόνα δεν φεύγει ποτέ από τη συσκευή.
 * Τα αρχεία (≈8 MB) είναι στο public/ocr και φορτώνονται μόνο την πρώτη φορά που χρειαστούν.
 *
 * Κάθε γλώσσα διαβάζεται ΧΩΡΙΣΤΑ (ένα πέρασμα ανά γλώσσα, στον ίδιο worker): σε δοκιμές, το ελληνικό μοντέλο χαλά τους
 * λατινικούς κωδικούς και τα ψηφία («WAU28…» → «ΨΨΝΑΟ…», «03» → «05»), ενώ το αγγλικό δεν διαβάζει ελληνικά. Άρα:
 * μάρκα, μοντέλο, ημερομηνίες από το πέρασμα «eng»· ελληνικές λέξεις από το «ell».
 */
import type { Worker } from 'tesseract.js';

export type OcrLang = 'eng' | 'ell';
export interface OcrOptions {
  langs: OcrLang[];
  /** true: σκόρπιο κείμενο (εξώφυλλο: λογότυπο, τίτλος, κωδικός)· false: συνεχές κείμενο σε γραμμές (απόδειξη) */
  sparse: boolean;
  onProgress?: (p: number) => void;
}

let worker: Promise<Worker> | null = null;
let loaded: OcrLang | null = null;
let idle: ReturnType<typeof setTimeout> | undefined;
let busy = false;
let report: ((p: number) => void) | null = null;

function get(first: OcrLang): Promise<Worker> {
  return (worker ??= import('tesseract.js').then(async ({ createWorker }) => {
    const base = new URL('ocr/', document.baseURI).href;
    const w = await createWorker(first, 1, {
      workerPath: `${base}worker.min.js`,
      workerBlobURL: false, // ο worker ξεκινά κατευθείαν από το δικό μας αρχείο (όχι μέσω blob:)
      corePath: `${base}tesseract-core-simd-lstm.wasm.js`,
      langPath: `${base}lang`,
      gzip: true,
      cacheMethod: 'none', // τα αρχεία είναι ήδη τοπικά στην εφαρμογή
      logger: (m) => { if (m.status === 'recognizing text') report?.(m.progress); },
    });
    loaded = first;
    return w;
  }));
}

/** Ο worker (WASM + δεδομένα γλώσσας, δεκάδες MB μνήμης) τερματίζεται 60 s μετά την τελευταία ανάγνωση. */
function release() {
  const w = worker;
  worker = null;
  loaded = null;
  void w?.then((x) => x.terminate()).catch(() => {});
}
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && !busy) release(); });

// οι αναγνώσεις εκτελούνται μία-μία (ένας worker, εναλλαγή γλώσσας)
let queue: Promise<unknown> = Promise.resolve();

/** Κείμενο εικόνας ανά γλώσσα. Γλώσσα που απέτυχε να διαβαστεί δίνει κενό κείμενο — η ροή δεν σταματά. */
export function readText(image: Blob | HTMLCanvasElement, o: OcrOptions): Promise<Record<OcrLang, string>> {
  const run = async () => {
    const out: Record<OcrLang, string> = { eng: '', ell: '' };
    clearTimeout(idle);
    busy = true;
    try {
      const { PSM } = await import('tesseract.js');
      const w = await get(o.langs[0] ?? 'eng');
      for (const [i, lang] of o.langs.entries()) {
        if (loaded !== lang) { await w.reinitialize(lang); loaded = lang; }
        await w.setParameters({ tessedit_pageseg_mode: o.sparse ? PSM.SPARSE_TEXT : PSM.SINGLE_BLOCK });
        report = (p) => o.onProgress?.((i + p) / o.langs.length);
        out[lang] = (await w.recognize(image)).data.text.trim();
      }
    } catch {
      release();
    } finally {
      report = null;
      busy = false;
      idle = setTimeout(release, 60_000);
    }
    return out;
  };
  const next = queue.then(run, run);
  queue = next.catch(() => {});
  return next;
}
