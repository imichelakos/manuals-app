/**
 * Κατηγορίες προϊόντων: σταθερή λίστα (το id αποθηκεύεται, η ετικέτα μεταφράζεται στην οθόνη).
 * `words`: λέξεις-κλειδιά (πεζά· η κανονικοποίηση τόνων/τελικού σίγμα γίνεται στο identify.ts) για την πρόταση κατηγορίας από το κείμενο του εντύπου.
 */
export const CATEGORY_IDS = [
  'kitchen', 'laundry', 'av', 'computing', 'climate', 'tools', 'care', 'kids', 'smart', 'vehicle', 'furniture', 'other',
] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export interface Category { id: CategoryId; label: string; words: string[] }

export const CATEGORIES: Category[] = [
  { id: 'kitchen', label: 'Κουζίνα', words: ['ψυγειο', 'ψυγειοκαταψυκτης', 'καταψυκτης', 'φουρνος', 'κουζινα', 'εστια', 'απορροφητηρας', 'πλυντηριο πιατων', 'μικροκυματων', 'καφετιερα', 'βραστηρας', 'φρυγανιερα', 'μιξερ', 'μπλεντερ', 'φριτεζα', 'refrigerator', 'fridge', 'freezer', 'oven', 'hob', 'cooker', 'dishwasher', 'microwave', 'coffee', 'espresso', 'kettle', 'toaster', 'blender', 'mixer', 'airfryer', 'fryer'] },
  { id: 'laundry', label: 'Πλύσιμο & καθαριότητα', words: ['πλυντηριο ρουχων', 'πλυντηριο', 'στεγνωτηριο', 'σιδερο', 'σκουπα', 'ατμοκαθαριστης', 'washing machine', 'washer', 'dryer', 'tumble', 'iron', 'vacuum', 'steam cleaner'] },
  { id: 'av', label: 'Εικόνα & ήχος', words: ['τηλεοραση', 'ηχειο', 'ηχεια', 'ακουστικα', 'προβολεας', 'αποκωδικοποιητης', 'television', 'tv', 'soundbar', 'speaker', 'headphones', 'earbuds', 'projector', 'receiver', 'camera', 'φωτογραφικη'] },
  { id: 'computing', label: 'Υπολογιστές & κινητά', words: ['υπολογιστης', 'κινητο', 'οθονη', 'εκτυπωτης', 'πληκτρολογιο', 'ποντικι', 'laptop', 'notebook', 'computer', 'smartphone', 'phone', 'tablet', 'monitor', 'printer', 'router', 'keyboard', 'mouse', 'modem'] },
  { id: 'climate', label: 'Κλιματισμός & θέρμανση', words: ['κλιματιστικο', 'αφυγραντηρας', 'θερμοσιφωνας', 'λεβητας', 'καλοριφερ', 'αεροθερμο', 'ανεμιστηρας', 'θερμαστρα', 'air conditioner', 'conditioner', 'dehumidifier', 'heater', 'boiler', 'fan', 'heat pump', 'thermostat', 'θερμοστατης'] },
  { id: 'tools', label: 'Εργαλεία & κήπος', words: ['δραπανο', 'τριβειο', 'πριονι', 'χλοοκοπτικο', 'πλυστικο', 'κατσαβιδι', 'drill', 'saw', 'grinder', 'sander', 'lawn mower', 'mower', 'pressure washer', 'trimmer', 'screwdriver', 'chainsaw'] },
  { id: 'care', label: 'Προσωπική φροντίδα', words: ['ξυριστικη', 'σεσουαρ', 'οδοντοβουρτσα', 'πιεσομετρο', 'ζυγαρια', 'shaver', 'hair dryer', 'toothbrush', 'epilator', 'trimmer', 'blood pressure', 'scale', 'thermometer', 'θερμομετρο'] },
  { id: 'kids', label: 'Παιδικά & παιχνίδια', words: ['καροτσι', 'καθισμα αυτοκινητου', 'παιχνιδι', 'κονσολα', 'stroller', 'car seat', 'toy', 'console', 'lego', 'baby', 'βρεφικο'] },
  { id: 'smart', label: 'Έξυπνο σπίτι', words: ['συναγερμος', 'καμερα ασφαλειας', 'εξυπνη πριζα', 'smart plug', 'smart home', 'hub', 'doorbell', 'alarm', 'sensor', 'αισθητηρας', 'θυροτηλεφωνο'] },
  { id: 'vehicle', label: 'Όχημα & ποδήλατο', words: ['αυτοκινητο', 'ποδηλατο', 'πατινι', 'μηχανη', 'car', 'bicycle', 'bike', 'scooter', 'motorcycle', 'dashcam'] },
  { id: 'furniture', label: 'Έπιπλα', words: ['επιπλο', 'ντουλαπα', 'κρεβατι', 'γραφειο', 'καρεκλα', 'ραφι', 'assembly instructions', 'οδηγιες συναρμολογησης', 'wardrobe', 'bed', 'desk', 'chair', 'shelf'] },
  { id: 'other', label: 'Άλλο', words: [] },
];

export const categoryById = (id: CategoryId): Category => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1]!;
