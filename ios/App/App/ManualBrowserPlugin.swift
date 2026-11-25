import Capacitor
import SafariServices
import UIKit

/// Αναζήτηση του εγχειριδίου στο Safari μέσα στην εφαρμογή (SFSafariViewController), με δική μας ενέργεια στο κουμπί
/// Κοινοποίησης: «Αποθήκευση στο προϊόν». Όταν ο χρήστης βρει το PDF (ή τη σελίδα του), την πατά· το Safari κλείνει και
/// η διεύθυνση επιστρέφει στην εφαρμογή, που το κατεβάζει (PdfDownloadPlugin). Η εφαρμογή δεν διαβάζει τις σελίδες
/// ούτε τα αποτελέσματα της αναζήτησης: βλέπει μόνο τη διεύθυνση που ο χρήστης επέλεξε να αποθηκεύσει.
/// APIs: SFSafariViewController(url:), SFSafariViewControllerDelegate.safariViewController(_:activityItemsFor:title:) και
/// safariViewControllerDidFinish(_:) (iOS 9+), UIActivity (activityType, activityTitle, activityImage,
/// canPerform(withActivityItems:), prepare(withActivityItems:), perform(), activityDidFinish(_:), activityCategory).
@objc(ManualBrowserPlugin)
public class ManualBrowserPlugin: CAPPlugin, CAPBridgedPlugin, SFSafariViewControllerDelegate {
    public let identifier = "ManualBrowserPlugin"
    public let jsName = "ManualBrowser"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise),
    ]

    private var pending: CAPPluginCall?
    private weak var safari: SFSafariViewController?
    private var actionTitle = ""
    private var closer: CloseOnBackground?

    /// url: η αναζήτηση (https) · actionTitle: το κείμενο της ενέργειας στην Κοινοποίηση ·
    /// closeOnBackground: κλείσιμο στο παρασκήνιο (ενεργό κλείδωμα).
    /// Απάντηση: { url } — η διεύθυνση που αποθήκευσε ο χρήστης, ή null αν έκλεισε το Safari.
    @objc func open(_ call: CAPPluginCall) {
        guard let raw = call.getString("url"), let url = URL(string: raw), url.scheme == "https" else {
            call.reject("Μη έγκυρη διεύθυνση", "bad-input")
            return
        }
        let title = call.getString("actionTitle") ?? ""
        let closeOnBackground = call.getBool("closeOnBackground") ?? false
        DispatchQueue.main.async {
            guard self.pending == nil else { call.reject("Το Safari είναι ήδη ανοιχτό", "busy"); return }
            self.pending = call
            self.actionTitle = title
            let safari = SFSafariViewController(url: url)
            safari.delegate = self
            safari.modalPresentationStyle = .fullScreen
            self.safari = safari
            self.closer = CloseOnBackground(enabled: closeOnBackground) { [weak self] in
                self?.safari?.dismiss(animated: false)
                self?.finish(nil)
            }
            self.bridge?.viewController?.present(safari, animated: true)
        }
    }

    public func safariViewController(_ controller: SFSafariViewController, activityItemsFor URL: URL, title: String?) -> [UIActivity] {
        [SaveActivity(title: actionTitle) { [weak self, weak controller] saved in
            // μετά το κλείσιμο του φύλλου Κοινοποίησης (activityDidFinish): κλείνει όλο το Safari
            DispatchQueue.main.async { controller?.presentingViewController?.dismiss(animated: true) }
            self?.finish(saved)
        }]
    }

    public func safariViewControllerDidFinish(_ controller: SFSafariViewController) { finish(nil) }

    /// Καλείται μία φορά: αποθήκευση (url) ή κλείσιμο (nil).
    private func finish(_ url: URL?) {
        guard let call = pending else { return }
        pending = nil
        closer = nil
        call.resolve(["url": url?.absoluteString ?? NSNull()])
    }
}

/// «Αποθήκευση στο προϊόν» στο φύλλο Κοινοποίησης του Safari: παίρνει τη διεύθυνση της σελίδας που βλέπει ο χρήστης.
private final class SaveActivity: UIActivity {
    private let title: String
    private let onSave: (URL) -> Void
    private var url: URL?

    init(title: String, onSave: @escaping (URL) -> Void) {
        self.title = title
        self.onSave = onSave
    }

    override class var activityCategory: UIActivity.Category { .action }
    override var activityType: UIActivity.ActivityType? { UIActivity.ActivityType("gr.yiami.manuals.save-to-product") }
    override var activityTitle: String? { title }
    override var activityImage: UIImage? { UIImage(systemName: "tray.and.arrow.down") }

    override func canPerform(withActivityItems activityItems: [Any]) -> Bool {
        activityItems.contains { ($0 as? URL)?.scheme == "https" }
    }

    override func prepare(withActivityItems activityItems: [Any]) {
        url = activityItems.compactMap { $0 as? URL }.first { $0.scheme == "https" }
    }

    override func perform() {
        let saved = url
        activityDidFinish(saved != nil)
        if let saved { onSave(saved) }
    }
}
