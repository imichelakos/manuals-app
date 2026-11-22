import Capacitor
import Foundation
import Security

/// Κλειδί κρυπτογράφησης των δεδομένων της εφαρμογής (src/data/vault.ts): 32 τυχαία bytes από το SecRandomCopyBytes,
/// στο Keychain ΜΟΝΟ γι' αυτή τη συσκευή (kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly, όχι synchronizable).
/// Κατά την Apple, τέτοια στοιχεία «δεν μεταφέρονται σε νέα συσκευή» ούτε επανέρχονται από αντίγραφο άλλης συσκευής:
/// τότε η εφαρμογή βλέπει κρυπτογραφημένα δεδομένα χωρίς κλειδί και ρωτά τον χρήστη (VaultProblem). Τα δεδομένα
/// ξαναέρχονται από τον συγχρονισμό iCloud ή το αντίγραφο ασφαλείας.
/// Όχι synchronizable επίτηδες: διαγραφή ενός synchronizable στοιχείου επηρεάζει όλα τα αντίγραφά του, άρα η «Διαγραφή
/// όλων» στο iPhone θα κλείδωνε τα δεδομένα του iPad.
/// ΣΗΜ.: δεν έχει μεταγλωττιστεί ούτε τρέξει ακόμη σε συσκευή.
@objc(SecureKeyPlugin)
public class SecureKeyPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SecureKeyPlugin"
    public let jsName = "SecureKey"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "storageKey", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deleteStorageKey", returnType: CAPPluginReturnPromise),
    ]

    private let service = "manuals.storage"
    private let account = "storage-key-v1"

    private var baseQuery: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword,
         kSecAttrService as String: service,
         kSecAttrAccount as String: account]
    }

    /// Το κλειδί σε base64· με create=true δημιουργείται αν δεν υπάρχει. `key: null` αν λείπει και create=false.
    @objc func storageKey(_ call: CAPPluginCall) {
        let create = call.getBool("create") ?? false
        var query = baseQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &out)
        if status == errSecSuccess, let data = out as? Data, data.count == 32 {
            call.resolve(["key": data.base64EncodedString()])
            return
        }
        guard status == errSecItemNotFound, create else {
            call.resolve(["key": NSNull(), "status": Int(status)])
            return
        }
        var bytes = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else {
            call.reject("random", "failed")
            return
        }
        let data = Data(bytes)
        var add = baseQuery
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        add[kSecAttrLabel as String] = "Εγχειρίδια – κλειδί δεδομένων"
        let added = SecItemAdd(add as CFDictionary, nil)
        if added == errSecSuccess { call.resolve(["key": data.base64EncodedString()]) }
        else { call.reject("keychain \(added)", "failed") }
    }

    /// «Διαγραφή όλων των δεδομένων» / ανάκτηση: σβήνει το κλειδί αυτής της συσκευής (μόνο αυτής).
    @objc func deleteStorageKey(_ call: CAPPluginCall) {
        let status = SecItemDelete(baseQuery as CFDictionary)
        call.resolve(["ok": status == errSecSuccess || status == errSecItemNotFound])
    }
}
