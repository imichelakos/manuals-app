import Capacitor
import PDFKit
import UIKit
import VisionKit

/// Σάρωση εγγράφων με τον σαρωτή του iOS (VisionKit): εντοπισμός άκρων, ίσιωμα, πολλές σελίδες στη σειρά.
/// Επιστρέφει τις σελίδες ως JPEG και, αν ζητηθεί, και ένα PDF με όλες (PDFKit). Οι εικόνες δεν φεύγουν από τη συσκευή.
/// APIs: VNDocumentCameraViewController (iOS 13+: isSupported, delegate), VNDocumentCameraScan (pageCount,
/// imageOfPage(at:)), PDFDocument() / PDFPage(image:) / insert(_:at:) / dataRepresentation() (iOS 11+).
@objc(DocumentScannerPlugin)
public class DocumentScannerPlugin: CAPPlugin, CAPBridgedPlugin, VNDocumentCameraViewControllerDelegate {
    public let identifier = "DocumentScannerPlugin"
    public let jsName = "DocumentScanner"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isSupported", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scan", returnType: CAPPluginReturnPromise),
    ]

    /// η κλήση που περιμένει τον σαρωτή (ένας σαρωτής τη φορά)
    private var pending: CAPPluginCall?
    private weak var scanner: VNDocumentCameraViewController?
    /// closeOnBackground (ενεργό κλείδωμα): ο σαρωτής κλείνει στο παρασκήνιο, σαν ακύρωση
    private var closer: CloseOnBackground?

    @objc func isSupported(_ call: CAPPluginCall) {
        call.resolve(["supported": VNDocumentCameraViewController.isSupported])
    }

    /// pdf: και PDF με όλες τις σελίδες · maxPages: πόσες σελίδες επιστρέφονται ως εικόνες (1–50) ·
    /// maxSide: μέγιστη πλευρά εικόνας σε px (800–3000) · closeOnBackground: κλείσιμο στο παρασκήνιο (ενεργό κλείδωμα).
    /// Απάντηση: { cancelled, pages: [base64 JPEG], pageCount, pdf: base64 | null }.
    @objc func scan(_ call: CAPPluginCall) {
        guard VNDocumentCameraViewController.isSupported else {
            call.reject("Η σάρωση δεν υποστηρίζεται σε αυτή τη συσκευή", "unsupported")
            return
        }
        guard pending == nil else {
            call.reject("Ο σαρωτής είναι ήδη ανοιχτός", "busy")
            return
        }
        pending = call
        DispatchQueue.main.async {
            let scanner = VNDocumentCameraViewController()
            scanner.delegate = self
            self.scanner = scanner
            self.closer = CloseOnBackground(enabled: call.getBool("closeOnBackground") ?? false) { [weak self] in
                guard let self, let scanner = self.scanner else { return }
                self.documentCameraViewControllerDidCancel(scanner)
            }
            self.bridge?.viewController?.present(scanner, animated: true)
        }
    }

    public func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFinishWith scan: VNDocumentCameraScan) {
        controller.dismiss(animated: true)
        closer = nil
        guard let call = pending else { return }
        pending = nil
        let wantPdf = call.getBool("pdf") ?? false
        let maxPages = max(1, min(call.getInt("maxPages") ?? 50, 50))
        let maxSide = CGFloat(max(800, min(call.getInt("maxSide") ?? 2000, 3000)))
        // οι εικόνες ζητούνται στο main thread (UIKit)· η συμπίεση και το PDF στο παρασκήνιο
        let images = (0..<scan.pageCount).map { scan.imageOfPage(at: $0) }
        DispatchQueue.global(qos: .userInitiated).async {
            let scaled = images.map { Self.fit($0, maxSide: maxSide) }
            let pages = scaled.prefix(maxPages).compactMap { $0.jpegData(compressionQuality: 0.8)?.base64EncodedString() }
            var pdf: Any = NSNull()
            if wantPdf {
                let doc = PDFDocument()
                for (i, image) in scaled.enumerated() {
                    if let page = PDFPage(image: image) { doc.insert(page, at: i) }
                }
                pdf = doc.dataRepresentation()?.base64EncodedString() ?? NSNull()
            }
            call.resolve(["cancelled": false, "pages": pages, "pageCount": images.count, "pdf": pdf])
        }
    }

    public func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
        controller.dismiss(animated: false)
        closer = nil
        pending?.resolve(["cancelled": true, "pages": [String](), "pageCount": 0, "pdf": NSNull()])
        pending = nil
    }

    public func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFailWithError error: Error) {
        controller.dismiss(animated: true)
        closer = nil
        pending?.reject("Η σάρωση απέτυχε", "failed")
        pending = nil
    }

    /// σμίκρυνση ώστε η μεγαλύτερη πλευρά να μην ξεπερνά το maxSide (ποτέ μεγέθυνση)
    private static func fit(_ image: UIImage, maxSide: CGFloat) -> UIImage {
        let side = max(image.size.width, image.size.height)
        guard side > maxSide else { return image }
        let k = maxSide / side
        let size = CGSize(width: (image.size.width * k).rounded(), height: (image.size.height * k).rounded())
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        return UIGraphicsImageRenderer(size: size, format: format).image { _ in image.draw(in: CGRect(origin: .zero, size: size)) }
    }
}
