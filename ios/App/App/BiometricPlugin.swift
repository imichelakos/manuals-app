import Capacitor
import LocalAuthentication

/// Κλείδωμα με Face ID / Touch ID, με εναλλακτική τον κωδικό της συσκευής (LAPolicy.deviceOwnerAuthentication).
/// Το iOS απαντά μόνο «ναι/όχι»: η εφαρμογή δεν βλέπει ποτέ βιομετρικά δεδομένα. Χρειάζεται το NSFaceIDUsageDescription.
/// ΣΗΜ.: δεν έχει μεταγλωττιστεί ούτε τρέξει ακόμη σε συσκευή.
@objc(BiometricPlugin)
public class BiometricPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BiometricPlugin"
    public let jsName = "Biometric"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "info", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "authenticate", returnType: CAPPluginReturnPromise),
    ]

    /// available: υπάρχει Face ID / Touch ID ή τουλάχιστον κωδικός συσκευής· type: τι βιομετρικό έχει η συσκευή.
    @objc func info(_ call: CAPPluginCall) {
        let context = LAContext()
        // κατά την Apple, το biometryType ορίζεται μόνο αφού κληθεί το canEvaluatePolicy
        _ = context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
        let available = context.canEvaluatePolicy(.deviceOwnerAuthentication, error: nil)
        let type: String
        switch context.biometryType {
        case .faceID: type = "faceID"
        case .touchID: type = "touchID"
        case .opticID: type = "opticID"
        default: type = "none"
        }
        call.resolve(["available": available, "type": type])
    }

    @objc func authenticate(_ call: CAPPluginCall) {
        let context = LAContext()
        let reason = call.getString("reason") ?? "Ξεκλείδωμα"
        context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) { ok, _ in
            call.resolve(["ok": ok])
        }
    }
}
