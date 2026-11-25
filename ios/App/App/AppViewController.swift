import UIKit
import WebKit
import Capacitor

/// Ο κεντρικός view controller της εφαρμογής: καταχωρίζει τα δικά μας plugins (αυτά που δεν έρχονται από πακέτο npm).
class AppViewController: CAPBridgeViewController {
    private var backgroundObserver: NSObjectProtocol?

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
        bridge?.registerPluginInstance(DocumentScannerPlugin())  // σαρωτής εγγράφων του iOS (VisionKit)
        bridge?.registerPluginInstance(ProductReaderPlugin())  // αναγνώριση προϊόντος στη συσκευή (Vision + Apple Foundation Models)
        bridge?.registerPluginInstance(QrScannerPlugin())  // ζωντανή σάρωση QR (VisionKit DataScanner)
        bridge?.registerPluginInstance(FilePreviewPlugin())  // προβολή αρχείων μέσα στην εφαρμογή (QuickLook)
        bridge?.registerPluginInstance(PdfDownloadPlugin())  // κατέβασμα PDF χωρίς CORS, με πρόοδο και ακύρωση
        bridge?.registerPluginInstance(ManualBrowserPlugin())  // αναζήτηση στο Safari με «Αποθήκευση στο προϊόν»
        exportBuildInfo()
        reportBackground()
    }

    /// Πραγματική έξοδος στο παρασκήνιο → γεγονός «appbackground» στη σελίδα (κλείδωμα με Face ID, data/appLock).
    /// Δεν αρκεί το «pause» του Capacitor: στέλνεται μόνο όταν η σελίδα είναι στο παράθυρο, και μια οθόνη πλήρους
    /// οθόνης (προβολή αρχείου, σαρωτής, QR) την αφαιρεί από αυτό όσο είναι ανοιχτή (UIModalPresentationStyle.fullScreen:
    /// «the views belonging to the presenting view controller are removed») — τότε η εφαρμογή δεν κλείδωνε (24/11/2026).
    /// APIs: UIApplication.didEnterBackgroundNotification, CAPBridgeProtocol.triggerDocumentJSEvent(eventName:).
    private func reportBackground() {
        backgroundObserver = NotificationCenter.default.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
            guard let self, self.webView?.isLoading == false else { return }
            self.bridge?.triggerDocumentJSEvent(eventName: "appbackground")
        }
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
