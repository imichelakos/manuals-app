import test from 'node:test';
import assert from 'node:assert/strict';
import { zlibSync, unzlibSync } from 'fflate';
import { countPdfPages } from '@/domain/pdfPages';
import { identifyPdf } from '@/services/scan';
import { suggestGroup, groupOf } from '@/domain/groups';
import { recyclingStats, manualPages } from '@/domain/recycling';
import { emptyItem, type Attachment, type Item } from '@/domain/model';

const enc = (s: string) => new TextEncoder().encode(s);
const cat = (...parts: Uint8Array[]) => { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };

test('countPdfPages: ρίζα /Pages, εμφωλευμένα λεξικά, object streams, εναλλακτική', () => {
  // απλό PDF: ρίζα με Count 12 και ένας ενδιάμεσος κόμβος με Count 4· εμφωλευμένο λεξικό πριν το /Type
  const plain = enc('%PDF-1.4\n1 0 obj << /Kids [2 0 R] /Resources << /Font << >> >> /Type /Pages /Count 12 >> endobj\n2 0 obj << /Type /Pages /Parent 1 0 R /Count 4 >> endobj\n3 0 obj << /Type /Outlines /Count 99 >> endobj');
  assert.equal(countPdfPages(plain, unzlibSync), 12);
  // PDF 1.5: το λεξικό σελίδων υπάρχει μόνο μέσα σε συμπιεσμένο object stream
  const inner = zlibSync(enc('1 0 << /Type /Pages /Kids [5 0 R] /Count 37 >>'));
  const objstm = cat(enc(`%PDF-1.5\n4 0 obj << /Type /ObjStm /N 1 /First 4 /Filter /FlateDecode /Length ${inner.length} >>\nstream\n`), inner, enc('\nendstream\nendobj'));
  assert.equal(countPdfPages(objstm, (b) => { try { return unzlibSync(b); } catch { return unzlibSync(b.subarray(0, b.length - 1)); } }), 37);
  // χωρίς /Count: μέτρηση των /Type /Page
  assert.equal(countPdfPages(enc('%PDF-1.4 << /Type /Page >> << /Type/Page >> << /Type /Pages >>'), unzlibSync), 2);
  assert.equal(countPdfPages(enc('%PDF-1.4 τίποτα'), unzlibSync), null);
});

test('suggestGroup: όνομα πρώτα, μετά κατηγορία', () => {
  assert.equal(suggestGroup({ name: 'Πλυντήριο πιάτων', category: 'kitchen' }), 'large');
  assert.equal(suggestGroup({ name: 'Βραστήρας', category: 'kitchen' }), 'small');
  assert.equal(suggestGroup({ name: 'Τηλεόραση OLED', category: 'other' }), 'electronics');
  assert.equal(suggestGroup({ name: 'Ντουλάπα PAX', category: 'other' }), 'unpowered');
  assert.equal(suggestGroup({ name: '', category: 'computing' }), 'electronics');
  assert.equal(suggestGroup({ name: '', category: 'vehicle' }), null);
  assert.equal(suggestGroup({ name: 'Tablecloth', category: 'other' }), null);              // «tablet» μόνο ως αρχή λέξης… «tablecloth» δεν ταιριάζει
  assert.equal(groupOf({ group: 'small', name: 'Ψυγείο', category: 'kitchen' }), 'small'); // η επιλογή του χρήστη υπερισχύει
});

test('recyclingStats: σελίδες και εκτίμηση βάρους', () => {
  const att = (p: Partial<Attachment>): Attachment => ({ id: Math.random().toString(36).slice(2).padEnd(12, 'x'), kind: 'manual', name: 'm.pdf', mime: 'application/pdf', size: 1, blobId: 'b'.repeat(12), addedAt: 1, origin: 'import', ...p });
  const a: Item = { ...emptyItem(1), paper: 'recycled', attachments: [att({ pages: 41 }), att({ pages: 12 })] };   // PDF: το μεγαλύτερο → 41 → 21 φύλλα
  const b: Item = { ...emptyItem(2), paper: 'recycled', attachments: [att({ mime: 'image/jpeg', pages: 1 }), att({ mime: 'image/jpeg', pages: 1 })] }; // 2 φωτογραφίες → 1 φύλλο
  const c: Item = { ...emptyItem(3), paper: 'recycled', attachments: [att({})] }; // άγνωστες σελίδες
  const d: Item = { ...emptyItem(4), attachments: [att({ pages: 8 })] };          // ψηφιακό, χαρτί κρατιέται
  assert.equal(manualPages(a), 41);
  assert.equal(manualPages(b), 2);
  const s = recyclingStats([a, b, c, d]);
  assert.equal(s.pagesDigital, 41 + 2 + 8);
  assert.equal(s.paperGrams, (21 + 1) * 2.5);
  assert.equal(s.paperUnknown, 1);
});

test('identifyPdf: μάρκα/μοντέλο από την πρώτη σελίδα, όχι από όλο το PDF', () => {
  const car = identifyPdf(['TOYOTA COROLLA\nOwner’s Manual', 'Seat belts and airbags. Smart key system. Mini spare wheel.', 'Car maintenance'], 'manual.pdf', []);
  assert.deepEqual([car.brands, car.models[0], car.category], [['Toyota'], 'COROLLA', 'vehicle']); // όχι SEAT/Smart/Mini
  const fallback = identifyPdf(['', 'SEAT Leon Owner manual — car'], 'manual.pdf', []);          // κενό εξώφυλλο → επόμενες σελίδες
  assert.equal(fallback.brands[0], 'SEAT');
  assert.equal(identifyPdf([''], 'Bosch-WAU28PH9BY.pdf', []).models[0], 'WAU28PH9BY');           // και από το όνομα αρχείου
});

test('identifyPdf: πραγματικό εγχειρίδιο (Nissan Micra) — η μάρκα μόνο στο όνομα του αρχείου, όχι στο κείμενο', () => {
  // αρχή του κειμένου όπως τη δίνει το PDF (η μάρκα είναι λογότυπο-εικόνα· στο κείμενο μόνο κωδικοί και ελληνικά)
  const page1 = 'NU 1678-3 B1322\nBIBΛIO OΔHΓIΩN XPHΣHΣΣ\nΚαλώς ήρθατε στο καινούργιο σας ηλεκτρικό αυτοκίνητο';
  const r = identifyPdf([page1], 'Nissan Micra INFO.pdf', []);
  assert.equal(r.brands[0], 'Nissan');
  assert.equal(r.models[0], 'Micra');
  assert.equal(r.category, 'vehicle');
});
