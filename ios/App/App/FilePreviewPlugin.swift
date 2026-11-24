import Capacitor
import QuickLook
import UIKit

/// Προβολή ενός αρχείου (PDF ή εικόνα) μέσα στην εφαρμογή με το QuickLook του iOS: ζουμ, αναζήτηση στο PDF, κοινοποίηση.
/// Με `editable`, ο χρήστης μπορεί να γράψει σημειώσεις (Markup)· οι αλλαγές αποθηκεύονται ΠΑΝΤΑ σε αντίγραφο
/// (.createCopy), που επιστρέφεται στην εφαρμογή — το αρχικό αρχείο δεν αλλάζει ποτέ.
/// Με `closeOnBackground` (ενεργό κλείδωμα), η προβολή κλείνει μόλις η εφαρμογή πάει στο παρασκήνιο, ώστε η οθόνη
/// κλειδώματος της εφαρμογής να μην κρύβεται πίσω από το έγγραφο.
/// APIs: QLPreviewController (iOS 4+), canPreview(_:), QLPreviewControllerDataSource, QLPreviewItem.previewItemURL /
/// previewItemTitle, QLPreviewControllerDelegate.previewController(_:editingModeFor:) και
/// previewController(_:didSaveEditedCopyOf:at:) (iOS 13+), previewControllerDidDismiss(_:).
@objc(FilePreviewPlugin)
public class FilePreviewPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FilePreviewPlugin"
    public let jsName = "FilePreview"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "preview", returnType: CAPPluginReturnPromise),
    ]

    private var pending: CAPPluginCall?
    private var session: PreviewSession?
    private weak var controller: QLPreviewController?
    private var backgroundObserver: NSObjectProtocol?

    /// path: file:// URL του αρχείου (το γράφει και το σβήνει η εφαρμογή). title: τίτλος στη γραμμή της προβολής.
    /// Απάντηση: { edited } — το αντίγραφο με τις σημειώσεις σε base64, ή null αν δεν έγιναν σημειώσεις.
    @objc func preview(_ call: CAPPluginCall) {
        guard let path = call.getString("path"), let url = URL(string: path), url.isFileURL else {
            call.reject("Δεν δόθηκε αρχείο", "bad-input")
            return
        }
        let title = call.getString("title")
        let editable = call.getBool("editable") ?? false
        let closeOnBackground = call.getBool("closeOnBackground") ?? false
        DispatchQueue.main.async {
            guard self.pending == nil else { call.reject("Η προβολή είναι ήδη ανοιχτή", "busy"); return }
            let item = PreviewItem(url: url, title: title)
            guard QLPreviewController.canPreview(item) else { call.reject("Το αρχείο δεν μπορεί να προβληθεί", "unsupported"); return }
            let session: PreviewSession
            do { session = try PreviewSession(item: item, editable: editable) { [weak self] in self?.finish() } } catch {
                call.reject("Η προβολή απέτυχε", "failed")
                return
            }
            self.pending = call
            self.session = session
            let ql = QLPreviewController()
            ql.dataSource = session
            ql.delegate = session
            self.controller = ql
            if closeOnBackground {
                self.backgroundObserver = NotificationCenter.default.addObserver(
                    forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
                    self?.controller?.dismiss(animated: false) { self?.finish() }
                }
            }
            self.bridge?.viewController?.present(ql, animated: true)
        }
    }

    /// Καλείται μία φορά, όταν κλείσει η προβολή (από τον χρήστη ή λόγω παρασκηνίου).
    private func finish() {
        guard let call = pending, let session = session else { return }
        pending = nil
        self.session = nil
        controller = nil
        if let o = backgroundObserver { NotificationCenter.default.removeObserver(o) }
        backgroundObserver = nil
        let edited = session.editedBase64()
        session.cleanUp()
        call.resolve(["edited": edited ?? NSNull()])
    }
}

private final class PreviewItem: NSObject, QLPreviewItem {
    let previewItemURL: URL?
    let previewItemTitle: String?
    init(url: URL, title: String?) {
        previewItemURL = url
        previewItemTitle = title
    }
}

/// Η πηγή δεδομένων και ο delegate μιας προβολής· κρατά το τελευταίο αντίγραφο με σημειώσεις σε δικό της προσωρινό φάκελο.
private final class PreviewSession: NSObject, QLPreviewControllerDataSource, QLPreviewControllerDelegate {
    private let item: PreviewItem
    private let editable: Bool
    private let onDismiss: () -> Void
    private let folder: URL
    private var editedURL: URL?

    init(item: PreviewItem, editable: Bool, onDismiss: @escaping () -> Void) throws {
        self.item = item
        self.editable = editable
        self.onDismiss = onDismiss
        folder = FileManager.default.temporaryDirectory.appendingPathComponent("preview-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
    }

    func numberOfPreviewItems(in controller: QLPreviewController) -> Int { 1 }
    func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> any QLPreviewItem { item }

    func previewController(_ controller: QLPreviewController, editingModeFor previewItem: any QLPreviewItem) -> QLPreviewItemEditingMode {
        editable ? .createCopy : .disabled
    }

    /// Μπορεί να κληθεί πολλές φορές (κάθε αποθήκευση των σημειώσεων)· κρατιέται η τελευταία εκδοχή.
    func previewController(_ controller: QLPreviewController, didSaveEditedCopyOf previewItem: any QLPreviewItem, at modifiedContentsURL: URL) {
        let target = folder.appendingPathComponent("edited").appendingPathExtension(modifiedContentsURL.pathExtension)
        try? FileManager.default.removeItem(at: target)
        do {
            try FileManager.default.copyItem(at: modifiedContentsURL, to: target)
            editedURL = target
        } catch {
            editedURL = nil
        }
    }

    func previewControllerDidDismiss(_ controller: QLPreviewController) { onDismiss() }

    func editedBase64() -> String? {
        guard let url = editedURL, let data = try? Data(contentsOf: url), !data.isEmpty else { return nil }
        return data.base64EncodedString()
    }

    func cleanUp() { try? FileManager.default.removeItem(at: folder) }
}
