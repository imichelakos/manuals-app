import UIKit
import WebKit
import Capacitor

/// Ο κεντρικός view controller της εφαρμογής: καταχωρίζει τα δικά μας plugins (αυτά που δεν έρχονται από πακέτο npm).
class AppViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        // συγχρονισμός iCloud: ΜΟΝΟ όταν έχει ενεργοποιηθεί το capability iCloud/CloudKit (Info.plist: ManualsICloudSyncEnabled).
        // Χωρίς το entitlement, το CKContainer.default() τερματίζει την εφαρμογή αντί να επιστρέψει σφάλμα.
        if Bundle.main.object(forInfoDictionaryKey: "ManualsICloudSyncEnabled") as? Bool == true {
            bridge?.registerPluginInstance(ICloudSyncPlugin())
        }
        bridge?.registerPluginInstance(SecureKeyPlugin())  // κλειδί κρυπτογράφησης στο Keychain
        bridge?.registerPluginInstance(BiometricPlugin())  // Face ID / Touch ID
        bridge?.registerPluginInstance(PdfReaderPlugin())  // ανάγνωση PDF (PDFKit) για την εισαγωγή στη σάρωση
        exportBuildInfo()
    }

    /// Διάγνωση (Ρυθμίσεις → Ασφάλεια): αποδεικνύει στη σελίδα ότι τρέχει ΑΥΤΟΣ ο view controller και πότε χτίστηκε το
    /// εκτελέσιμο — ώστε να φαίνεται αμέσως αν η συσκευή τρέχει παλιό build. Μόνο ημερομηνία και αν υπάρχει bridge.
    private func exportBuildInfo() {
        var built = ""
        if let path = Bundle.main.executablePath,
           let date = (try? FileManager.default.attributesOfItem(atPath: path))?[.modificationDate] as? Date {
            built = ISO8601DateFormatter().string(from: date)
        }
        let js = "window.__manualsNative = { vc: 'AppViewController', bridge: \(bridge != nil), built: '\(built)' };"
        webView?.configuration.userContentController.addUserScript(
            WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: true))
    }
}
