/**
 * Μοντέλο δεδομένων: ένα «προϊόν» (Item) με τα έγγραφά του. Καθαροί τύποι + σχήματα zod — καμία πρόσβαση σε δίσκο/οθόνη.
 * Τα σχήματα ελέγχουν ό,τι έρχεται ΑΠΟ ΕΞΩ (αντίγραφο ασφαλείας, μελλοντικός συγχρονισμός): τίποτα δεν μπαίνει στη βάση
 * χωρίς να περάσει από εδώ.
 */
import { z } from 'zod';
import { CURRENCY_CODE } from './currency';
import { CATEGORY_IDS } from './categories';
import { GROUP_IDS } from './groups';

/** Ημερομηνία ημερολογίου «ΕΕΕΕ-ΜΜ-ΗΗ» (χωρίς ώρα/ζώνη: η εγγύηση μετρά ημέρες, όχι στιγμές). */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const id = z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/);
const short = z.string().max(300);

export const attachmentKinds = ['manual', 'receipt', 'cover', 'other'] as const;
export type AttachmentKind = (typeof attachmentKinds)[number];

/** Αρχείο του προϊόντος (PDF ή εικόνα). Τα bytes ζουν στο BlobStore με κλειδί blobId· εδώ μόνο τα στοιχεία του. */
export const attachmentSchema = z.object({
  id,
  kind: z.enum(attachmentKinds),
  name: short,
  mime: z.string().max(100),
  size: z.number().int().nonnegative(),
  blobId: id,
  /** μικρογραφία (μόνο για εικόνες) */
  thumbId: id.optional(),
  addedAt: z.number().int(),
  /** από πού ήρθε: σάρωση με κάμερα, εισαγωγή αρχείου ή κατέβασμα από διεύθυνση */
  origin: z.enum(['scan', 'import', 'download']),
  sourceUrl: z.string().max(2000).optional(),
  /** σελίδες: του PDF (μετρημένες κατά την αποθήκευση) ή 1 για φωτογραφία σελίδας */
  pages: z.number().int().min(1).max(100_000).optional(),
});
export type Attachment = z.infer<typeof attachmentSchema>;

export const linkKinds = ['video', 'pdf', 'app', 'web'] as const;
export type LinkKind = (typeof linkKinds)[number];

/** Σύνδεσμος που αρχειοθετήθηκε (π.χ. από QR του εντύπου: βίντεο, σελίδα υποστήριξης, PDF). */
export const linkSchema = z.object({
  id,
  url: z.string().max(2000),
  title: short,
  kind: z.enum(linkKinds),
  origin: z.enum(['qr', 'manual']),
  addedAt: z.number().int(),
  /** εικονίδιο της σελίδας ή μικρογραφία του βίντεο, σμικρυμένο (≤128 px) μέσα στην εγγραφή — όχι ξεχωριστό αρχείο */
  icon: z.string().max(24_000).regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/).optional(),
});
export type LinkRef = z.infer<typeof linkSchema>;

export const itemSchema = z.object({
  id,
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  /** διαγραμμένο (μένει ως «ταφόπλακα» ώστε η διαγραφή να περάσει και στις άλλες συσκευές) */
  deleted: z.boolean().optional(),
  name: short,
  brand: short,
  model: short,
  serial: short,
  category: z.enum(CATEGORY_IDS),
  /** ομάδα που διάλεξε ο χρήστης· λείπει → προτείνεται από όνομα/κατηγορία (domain/groups) */
  group: z.enum(GROUP_IDS).optional(),
  room: short,
  tags: z.array(z.string().max(40)).max(30),
  notes: z.string().max(20_000),
  purchase: z.object({
    date: isoDate.optional(),
    store: short.optional(),
    price: z.number().nonnegative().max(10_000_000).optional(),
    /** ISO 4217· λείπει → ευρώ (domain/currency) */
    currency: z.string().regex(CURRENCY_CODE).optional(),
  }),
  warranty: z.object({
    /** διάρκεια σε μήνες από την ημερομηνία αγοράς */
    months: z.number().int().min(0).max(600).optional(),
    /** ρητή λήξη (υπερισχύει της διάρκειας), π.χ. επέκταση εγγύησης */
    until: isoDate.optional(),
    note: short.optional(),
    /** εγγυήσεις για συγκεκριμένα μέρη (π.χ. συμπιεστής 10 χρόνια), με δική τους διάρκεια ή λήξη */
    parts: z.array(z.object({
      id,
      name: short,
      months: z.number().int().min(1).max(600).optional(),
      until: isoDate.optional(),
      note: short.optional(),
    })).max(20).optional(),
  }),
  attachments: z.array(attachmentSchema).max(200),
  links: z.array(linkSchema).max(200),
  /** barcode προϊόντος (EAN/UPC), αν υπήρχε στο έντυπο */
  ean: z.string().max(20).optional(),
  /** κείμενο που αναγνωρίστηκε από το εξώφυλλο — μόνο για αναζήτηση */
  ocrText: z.string().max(20_000).optional(),
  /** το έντυπο: το έχω ακόμη ή ανακυκλώθηκε */
  paper: z.enum(['kept', 'recycled']),
});
export type Item = z.infer<typeof itemSchema>;

/** Τυχαίο αναγνωριστικό 128 bit (base64url, 22 χαρακτήρες). */
export function newId(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function emptyItem(now: number = Date.now()): Item {
  return {
    id: newId(), createdAt: now, updatedAt: now,
    name: '', brand: '', model: '', serial: '', category: 'other', room: '', tags: [], notes: '',
    purchase: {}, warranty: {}, attachments: [], links: [], paper: 'kept',
  };
}

/** Διάρκεια εγγύησης κάθε νέου προϊόντος· αλλάζει ανά προϊόν (απόφαση 23/11/2026: όχι ρύθμιση). */
export const DEFAULT_WARRANTY_MONTHS = 24;
/** Νέο προϊόν από τον χρήστη: κενό, με τη συνήθη εγγύηση. */
export const newProduct = (now: number = Date.now()): Item => ({ ...emptyItem(now), warranty: { months: DEFAULT_WARRANTY_MONTHS } });

/** Τίτλος για εμφάνιση: όνομα, αλλιώς μάρκα + μοντέλο, αλλιώς κενό (η οθόνη βάζει «Χωρίς όνομα»). */
export const displayName = (i: Pick<Item, 'name' | 'brand' | 'model'>): string =>
  i.name.trim() || [i.brand, i.model].map((s) => s.trim()).filter(Boolean).join(' ');

export const hasDigitalManual = (i: Item): boolean => i.attachments.some((a) => a.kind === 'manual');
export const hasReceipt = (i: Item): boolean => i.attachments.some((a) => a.kind === 'receipt');
export const coverOf = (i: Item): Attachment | undefined => i.attachments.find((a) => a.kind === 'cover');

export type WarrantyPart = NonNullable<Item['warranty']['parts']>[number];
