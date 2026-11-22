# Συγχρονισμός iCloud

Αυτόματος συγχρονισμός της βιβλιοθήκης ανάμεσα στις συσκευές του ίδιου Apple ID, μέσω της **ιδιωτικής βάσης CloudKit**
του χρήστη. Δεν υπάρχει δικός μας server ούτε λογαριασμοί. Είναι κλειστός μέχρι να τον ανοίξει ο χρήστης στις Ρυθμίσεις.

> Κατάσταση: η λογική συγχρονισμού (`src/data/syncEngine.ts`) καλύπτεται από τεστ. Ο κώδικας Swift
> (`ios/App/App/ICloudSyncPlugin.swift`) **δεν έχει μεταγλωττιστεί ούτε τρέξει** — γράφτηκε απέναντι στην τεκμηρίωση της Apple.

## Πώς δουλεύει

| Κομμάτι | Αρχείο | Ρόλος |
|---|---|---|
| Κανόνας συγχώνευσης | `src/domain/merge.ts` | Ανά προϊόν κερδίζει η νεότερη αλλαγή· σε ισοπαλία, η ίδια εκδοχή σε κάθε συσκευή. |
| Συμβόλαιο παρόχου | `src/data/sync.ts` | `pull / push / putBlob / getBlob / removeBlobs`. Ο πάροχος μόνο μεταφέρει. |
| Μηχανή | `src/data/syncEngine.ts` | Ένας κύκλος: κατέβασμα → αρχεία που λείπουν → ανέβασμα (πρώτα αρχεία) → καθάρισμα. Χωρίς εξάρτηση από iCloud. |
| Πότε τρέχει | `src/data/syncRuntime.ts` | Εκκίνηση, επιστροφή στην εφαρμογή, επαναφορά δικτύου, 4 s μετά από αλλαγή, «Συγχρονισμός τώρα». |
| Γέφυρα | `src/services/icloud.ts` | Καλεί το plugin· μεταφράζει σφάλματα σε `SyncError`. |
| CloudKit | `ios/App/App/ICloudSyncPlugin.swift` | Ζώνη `Library` (τύπος `Item`, πεδίο `json` κρυπτογραφημένο), ζώνη `Files` (τύπος `Blob`, πεδίο `file` ως `CKAsset`). |

Οι διαγραφές ταξιδεύουν ως «ταφόπλακες» μέσα στο JSON του προϊόντος· εγγραφές `Item` δεν σβήνονται ποτέ από το CloudKit.

## Τι πρέπει να γίνει στο Xcode (μία φορά)

Πηγή: [Enabling CloudKit in Your App](https://developer.apple.com/documentation/cloudkit/enabling-cloudkit-in-your-app).

1. **Πρώτα οριστικοποίησε το bundle identifier** (`appId` στο `capacitor.config.ts`). Το container παίρνει το όνομα
   `iCloud.<bundle id>` και, κατά την Apple, «δεν μπορεί να διαγραφεί ή να μετονομαστεί» αφού δημιουργηθεί.
2. Στόχος App → *Signing & Capabilities* → *Automatically manage signing* και ομάδα ανάπτυξης.
3. *+ Capability* → **iCloud** → επίλεξε **CloudKit** → επίλεξε το container. (Το Xcode προσθέτει και τα Push Notifications.)
4. Στη συσκευή ή στον simulator, σύνδεση με λογαριασμό iCloud.
5. Τρέξε την εφαρμογή σε δύο συσκευές, άνοιξε τον συγχρονισμό στις Ρυθμίσεις και στις δύο.

Το project δεν έχει ακόμη αρχείο entitlements· το δημιουργεί το βήμα 3.

## Πριν από App Store

- Σε ανάπτυξη οι τύποι εγγραφών δημιουργούνται μόνοι τους την πρώτη φορά που αποθηκεύεται εγγραφή («just-in-time schema»,
  [Designing and Creating a CloudKit Database](https://developer.apple.com/documentation/cloudkit/designing-and-creating-a-cloudkit-database)).
- Οι εφαρμογές του App Store βλέπουν μόνο το περιβάλλον παραγωγής: το σχήμα πρέπει να αναπτυχθεί εκεί από το CloudKit
  Console → *Deploy Schema Changes*
  ([Deploying an iCloud Container’s Schema](https://developer.apple.com/documentation/cloudkit/deploying-an-icloud-container-s-schema)).
  Πεδία και τύποι που έχουν πάει στην παραγωγή δεν διαγράφονται.

## Τι να ελεγχθεί στη συσκευή

Όσα δεν μπορούν να επαληθευτούν χωρίς Xcode και λογαριασμό iCloud:

- Ότι το plugin μεταγλωττίζεται (Swift 5, iOS 15+) και ότι το `App.xcodeproj` ανοίγει σωστά με τα δύο νέα αρχεία.
- Τι συμβαίνει αν ανοίξει ο συγχρονισμός **χωρίς** το capability iCloud (σφάλμα `missingEntitlement` ή τερματισμός;).
- Πρώτο ανέβασμα: δημιουργία ζώνης μετά από `zoneNotFound`.
- Δεύτερη συσκευή: κατέβασμα προϊόντων και αρχείων· ταυτόχρονες αλλαγές· διαγραφή.
- Διαγραφή των δεδομένων της εφαρμογής από Ρυθμίσεις → iCloud → Διαχείριση χώρου, και ξανά άνοιγμα του συγχρονισμού
  (`userDeletedZone` → `createZones`).
- Μεγάλα PDF: τα αρχεία περνούν ως base64 από τη γέφυρα προς το iOS (όριο 100 MB ανά αρχείο, `ICLOUD_MAX_BLOB_BYTES`).

## Γνωστά όρια

- Δεν υπάρχουν ειδοποιήσεις push: μια αλλαγή φτάνει στην άλλη συσκευή όταν εκείνη ανοίξει ή ξαναέρθει μπροστά.
- Το πεδίο `json` χρησιμοποιεί `encryptedValues`: κατά την Apple κρυπτογραφείται στη συσκευή πριν από την αποστολή, και τα
  κλειδιά είναι διαθέσιμα αποκλειστικά στον κάτοχο όταν είναι ενεργή η Advanced Data Protection
  ([encryptedValues](https://developer.apple.com/documentation/cloudkit/ckrecord/encryptedvalues)).
- Αρχείο που ανέβασε συσκευή η οποία δεν ξανασυνδέθηκε ποτέ μπορεί να μείνει ορφανό στο iCloud μετά τη διαγραφή του προϊόντος.
