import Capacitor
import CloudKit
import Foundation

/// Συγχρονισμός μέσω iCloud: απλή ΜΕΤΑΦΟΡΑ προϊόντων και αρχείων από/προς την ιδιωτική βάση CloudKit του χρήστη.
/// Δεν αποφασίζει ποια εκδοχή κερδίζει — αυτό το κάνει η μηχανή συγχρονισμού στο JavaScript (src/data/syncEngine.ts).
///
/// Τι αποθηκεύεται:
///  - ζώνη «Library», τύπος «Item»: μία εγγραφή ανά προϊόν (όνομα «i.<id>»), με όλο το προϊόν ως JSON στο
///    ΚΡΥΠΤΟΓΡΑΦΗΜΕΝΟ πεδίο «json» (encryptedValues: κρυπτογράφηση στη συσκευή πριν από την αποστολή).
///  - ζώνη «Files», τύπος «Blob»: μία εγγραφή ανά αρχείο (όνομα «b.<blobId>»), με τα bytes ως CKAsset στο πεδίο «file».
///    Χωριστή ζώνη, ώστε το κατέβασμα αλλαγών της «Library» να μη φέρνει μαζί του αρχεία.
/// Τα ονόματα έχουν πρόθεμα γιατί ένα όνομα εγγραφής δεν επιτρέπεται να αρχίζει με «_» (τα id μας μπορεί).
///
/// Σφάλματα: κάθε απόρριψη έχει `code` από το λεξιλόγιο του SyncError (src/data/sync.ts).
/// ΣΗΜ.: δεν έχει μεταγλωττιστεί ούτε τρέξει ακόμη σε συσκευή. Χρειάζεται το capability iCloud → CloudKit στο Xcode.
@objc(ICloudSyncPlugin)
public class ICloudSyncPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ICloudSyncPlugin"
    public let jsName = "ICloudSync"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pull", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "push", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "putBlob", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getBlob", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "removeBlobs", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "createZones", returnType: CAPPluginReturnPromise),
    ]

    private let itemsZone = CKRecordZone.ID(zoneName: "Library", ownerName: CKCurrentUserDefaultName)
    private let filesZone = CKRecordZone.ID(zoneName: "Files", ownerName: CKCurrentUserDefaultName)
    /// Η ιδιωτική βάση του χρήστη στο προεπιλεγμένο container της εφαρμογής (αυτό που ορίζει το capability iCloud).
    private var database: CKDatabase { CKContainer.default().privateCloudDatabase }

    private func itemID(_ id: String) -> CKRecord.ID { CKRecord.ID(recordName: "i." + id, zoneID: itemsZone) }
    private func blobID(_ id: String) -> CKRecord.ID { CKRecord.ID(recordName: "b." + id, zoneID: filesZone) }

    // MARK: - Μέθοδοι προς το JavaScript

    /// Υπάρχει διαθέσιμος λογαριασμός iCloud στη συσκευή;
    @objc func status(_ call: CAPPluginCall) {
        CKContainer.default().accountStatus { status, _ in
            call.resolve(["available": status == .available])
        }
    }

    /// Προϊόντα που άλλαξαν μετά το σημάδι `cursor` ("" = από την αρχή). Επιστρέφει το JSON κάθε προϊόντος, το νέο
    /// σημάδι και αν υπάρχουν κι άλλα.
    @objc func pull(_ call: CAPPluginCall) {
        let cursor = call.getString("cursor") ?? ""
        var token: CKServerChangeToken?
        if !cursor.isEmpty {
            guard let decoded = Self.decodeToken(cursor) else { call.reject("unreadable cursor", "cursor-expired"); return }
            token = decoded
        }
        Task {
            do {
                let changes = try await database.recordZoneChanges(inZoneWith: itemsZone, since: token)
                var items: [String] = []
                for (_, outcome) in changes.modificationResultsByID {
                    switch outcome {
                    case .success(let modification):
                        if let json = modification.record.encryptedValues["json"] as? NSString { items.append(json as String) }
                    case .failure(let error):
                        // μια εγγραφή που δεν ήρθε δεν πρέπει να «χαθεί» πίσω από το νέο σημάδι: ολόκληρο το κατέβασμα ξαναγίνεται
                        throw error
                    }
                }
                // οι διαγραφές εγγραφών αγνοούνται: τα διαγραμμένα προϊόντα ταξιδεύουν ως «ταφόπλακες» μέσα στο JSON
                call.resolve(["items": items, "cursor": Self.encodeToken(changes.changeToken), "more": changes.moreComing])
            } catch {
                // η ζώνη δεν υπάρχει ακόμη: καμία συσκευή δεν έχει ανεβάσει τίποτα
                if Self.code(of: error) == .zoneNotFound { call.resolve(["items": [String](), "cursor": "", "more": false]); return }
                Self.reject(call, error)
            }
        }
    }

    /// Αποθηκεύει (ή αντικαθιστά) προϊόντα: `ids[i]` με JSON `jsons[i]`. Όλα ή κανένα.
    @objc func push(_ call: CAPPluginCall) {
        guard let ids = call.getArray("ids", String.self), let jsons = call.getArray("jsons", String.self), ids.count == jsons.count else {
            call.reject("ids/jsons", "failed"); return
        }
        let records = zip(ids, jsons).map { id, json -> CKRecord in
            let record = CKRecord(recordType: "Item", recordID: itemID(id))
            record.encryptedValues["json"] = json as NSString
            return record
        }
        Task {
            do { try await save(records, in: itemsZone); call.resolve() } catch { Self.reject(call, error) }
        }
    }

    /// Ανεβάζει ένα αρχείο (`data`: base64).
    @objc func putBlob(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), let text = call.getString("data"), let data = Data(base64Encoded: text) else {
            call.reject("id/data", "failed"); return
        }
        Task {
            // το CKAsset διαβάζει από αρχείο: προσωρινό αντίγραφο, που σβήνεται μόλις τελειώσει το ανέβασμα
            let url = FileManager.default.temporaryDirectory.appendingPathComponent("upload-" + UUID().uuidString)
            defer { try? FileManager.default.removeItem(at: url) }
            do {
                try data.write(to: url, options: .atomic)
                let record = CKRecord(recordType: "Blob", recordID: blobID(id))
                record["file"] = CKAsset(fileURL: url)
                try await save([record], in: filesZone)
                call.resolve()
            } catch { Self.reject(call, error) }
        }
    }

    /// Κατεβάζει ένα αρχείο ως base64· `data: null` αν δεν υπάρχει (ακόμη) στο iCloud.
    @objc func getBlob(_ call: CAPPluginCall) {
        guard let id = call.getString("id") else { call.reject("id", "failed"); return }
        let recordID = blobID(id)
        Task {
            do {
                let results = try await database.records(for: [recordID])
                guard let outcome = results[recordID] else { call.resolve(["data": NSNull()]); return }
                switch outcome {
                case .success(let record):
                    guard let asset = record["file"] as? CKAsset, let url = asset.fileURL else { call.resolve(["data": NSNull()]); return }
                    let bytes = try Data(contentsOf: url)
                    call.resolve(["data": bytes.base64EncodedString()])
                case .failure(let error):
                    if Self.isMissing(error) { call.resolve(["data": NSNull()]) } else { Self.reject(call, error) }
                }
            } catch {
                if Self.isMissing(error) { call.resolve(["data": NSNull()]) } else { Self.reject(call, error) }
            }
        }
    }

    /// Σβήνει αρχεία από το iCloud. Όσα δεν υπάρχουν ήδη αγνοούνται.
    @objc func removeBlobs(_ call: CAPPluginCall) {
        guard let ids = call.getArray("ids", String.self) else { call.reject("ids", "failed"); return }
        let recordIDs = ids.map { blobID($0) }
        Task {
            do {
                let result = try await database.modifyRecords(saving: [], deleting: recordIDs, savePolicy: .allKeys, atomically: false)
                for (_, outcome) in result.deleteResults {
                    if case .failure(let error) = outcome, !Self.isMissing(error) { throw error }
                }
                call.resolve()
            } catch {
                if Self.isMissing(error) { call.resolve() } else { Self.reject(call, error) }
            }
        }
    }

    /// Δημιουργεί ξανά τις δύο ζώνες. Καλείται ΜΟΝΟ όταν ο χρήστης ξανανοίγει ρητά τον συγχρονισμό αφού είχε σβήσει τα
    /// δεδομένα της εφαρμογής από το iCloud (userDeletedZone) — ποτέ αυτόματα.
    @objc func createZones(_ call: CAPPluginCall) {
        Task {
            do {
                let created = try await database.modifyRecordZones(saving: [CKRecordZone(zoneID: itemsZone), CKRecordZone(zoneID: filesZone)], deleting: [])
                for (_, outcome) in created.saveResults { if case .failure(let error) = outcome { throw error } }
                call.resolve()
            } catch { Self.reject(call, error) }
        }
    }

    // MARK: - Αποθήκευση

    /// Αποθήκευση εγγραφών· αν η ζώνη δεν υπάρχει ακόμη (πρώτο ανέβασμα), τη δημιουργεί και ξαναδοκιμάζει μία φορά.
    /// Ζώνη που έσβησε ο χρήστης από τις Ρυθμίσεις (userDeletedZone) ΔΕΝ ξαναδημιουργείται εδώ.
    private func save(_ records: [CKRecord], in zone: CKRecordZone.ID) async throws {
        do {
            try await saveOnce(records)
        } catch {
            guard Self.code(of: error) == .zoneNotFound else { throw error }
            let created = try await database.modifyRecordZones(saving: [CKRecordZone(zoneID: zone)], deleting: [])
            for (_, outcome) in created.saveResults { if case .failure(let zoneError) = outcome { throw zoneError } }
            try await saveOnce(records)
        }
    }

    /// `.allKeys`: η εγγραφή αντικαθίσταται ολόκληρη, είτε υπάρχει ήδη είτε όχι (η επιλογή της νικήτριας εκδοχής έχει
    /// γίνει πριν, στη μηχανή συγχρονισμού).
    private func saveOnce(_ records: [CKRecord]) async throws {
        let result = try await database.modifyRecords(saving: records, deleting: [], savePolicy: .allKeys, atomically: true)
        for (_, outcome) in result.saveResults { if case .failure(let error) = outcome { throw error } }
    }

    // MARK: - Σημάδι αλλαγών (CKServerChangeToken ↔ κείμενο base64)

    private static func encodeToken(_ token: CKServerChangeToken) -> String {
        let coder = NSKeyedArchiver(requiringSecureCoding: true)
        coder.encode(token, forKey: "token")
        return coder.encodedData.base64EncodedString()
    }

    private static func decodeToken(_ text: String) -> CKServerChangeToken? {
        guard let data = Data(base64Encoded: text), let coder = try? NSKeyedUnarchiver(forReadingFrom: data) else { return nil }
        return coder.decodeObject(of: CKServerChangeToken.self, forKey: "token")
    }

    // MARK: - Σφάλματα

    /// Ο κωδικός CloudKit ενός σφάλματος· σε «μερική αποτυχία», ο κωδικός του πρώτου επιμέρους σφάλματος.
    private static func code(of error: Error) -> CKError.Code? {
        guard let ck = error as? CKError else { return nil }
        if ck.code == .partialFailure, let first = ck.partialErrorsByItemID?.values.first { return code(of: first) }
        return ck.code
    }

    /// «Δεν υπάρχει»: η εγγραφή ή η ζώνη της.
    private static func isMissing(_ error: Error) -> Bool {
        let c = code(of: error)
        return c == .unknownItem || c == .zoneNotFound
    }

    /// Απόρριψη με κωδικό από το λεξιλόγιο του SyncError.
    private static func reject(_ call: CAPPluginCall, _ error: Error) {
        let name: String
        switch code(of: error) {
        case .notAuthenticated: name = "no-account"
        case .networkUnavailable, .networkFailure, .serviceUnavailable, .requestRateLimited, .zoneBusy, .accountTemporarilyUnavailable: name = "offline"
        case .changeTokenExpired: name = "cursor-expired"
        case .userDeletedZone: name = "remote-deleted"
        case .quotaExceeded: name = "quota"
        default: name = "failed"
        }
        // χωρίς περιεχόμενο χρήστη στο μήνυμα: μόνο ο κωδικός του CloudKit
        let detail = (error as? CKError).map { "CKError \($0.code.rawValue)" } ?? "error"
        call.reject(detail, name)
    }
}
