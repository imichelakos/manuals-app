// Αντιγράφει στο public/ ό,τι φορτώνεται στον χρόνο εκτέλεσης από βιβλιοθήκες — τοπικά, χωρίς CDN:
//  - OCR (Tesseract, ελληνικά + αγγλικά) → public/ocr
//  - ανάγνωση QR / barcode (ZXing wasm)  → public/zxing
import { copyFileSync, mkdirSync } from 'node:fs';
const nm = 'node_modules';
mkdirSync('public/ocr/lang', { recursive: true });
copyFileSync(`${nm}/tesseract.js/dist/worker.min.js`, 'public/ocr/worker.min.js');
for (const f of ['tesseract-core-simd-lstm.wasm.js', 'tesseract-core-lstm.wasm.js']) copyFileSync(`${nm}/tesseract.js-core/${f}`, `public/ocr/${f}`);
for (const l of ['ell', 'eng']) copyFileSync(`${nm}/@tesseract.js-data/${l}/4.0.0_best_int/${l}.traineddata.gz`, `public/ocr/lang/${l}.traineddata.gz`);
mkdirSync('public/zxing', { recursive: true });
copyFileSync(`${nm}/zxing-wasm/dist/reader/zxing_reader.wasm`, 'public/zxing/zxing_reader.wasm');
console.log('assets → public/ocr, public/zxing');
