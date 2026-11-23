import Capacitor
import PDFKit
import UIKit

/// Ανάγνωση PDF στη συσκευή με το PDFKit της Apple: πλήθος σελίδων, κείμενο των πρώτων σελίδων και η πρώτη σελίδα ως
/// εικόνα JPEG (εξώφυλλο). Χρησιμοποιείται από την «Εισαγωγή PDF» της σάρωσης για προσυμπλήρωση (μάρκα, μοντέλο,
/// κατηγορία). Το αρχείο δεν φεύγει από τη συσκευή. APIs (iOS 11+): PDFDocument(data:), isLocked, pageCount,
/// page(at:), PDFPage.string, bounds(for:), thumbnail(of:for:).
@objc(PdfReaderPlugin)
public class PdfReaderPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PdfReaderPlugin"
    public let jsName = "PdfReader"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "read", returnType: CAPPluginReturnPromise),
    ]

    /// data: το PDF σε base64 · maxPages: από πόσες σελίδες κείμενο (1–10) · coverWidth: πλάτος εικόνας (200–2400 px).
    /// Απάντηση: { pages, pageTexts: [κείμενο ανά σελίδα, από την 1η], cover: base64 JPEG της 1ης | null,
    /// page2: base64 JPEG της 2ης | null, locked }. Οι εικόνες χρησιμεύουν και για OCR όταν η μάρκα είναι μόνο λογότυπο.
    @objc func read(_ call: CAPPluginCall) {
        guard let b64 = call.getString("data"), let data = Data(base64Encoded: b64) else {
            call.reject("Δεν δόθηκε PDF", "bad-input")
            return
        }
        let maxPages = max(1, min(call.getInt("maxPages") ?? 3, 10))
        let width = CGFloat(max(200, min(call.getInt("coverWidth") ?? 1400, 2400)))
        DispatchQueue.global(qos: .userInitiated).async {
            guard let doc = PDFDocument(data: data) else {
                call.reject("Δεν είναι PDF", "not-pdf")
                return
            }
            // PDF με κωδικό: μόνο το πλήθος σελίδων· ούτε κείμενο ούτε εικόνα
            if doc.isLocked {
                call.resolve(["pages": doc.pageCount, "pageTexts": [String](), "cover": NSNull(), "page2": NSNull(), "locked": true])
                return
            }
            // κείμενο ανά σελίδα: η εφαρμογή ψάχνει μάρκα/μοντέλο πρώτα στην 1η (εξώφυλλο), όχι σε όλο το έγγραφο
            var pageTexts: [String] = []
            for i in 0..<min(maxPages, doc.pageCount) {
                pageTexts.append(String((doc.page(at: i)?.string ?? "").prefix(20_000)))
            }
            /// σελίδα → JPEG σε base64 (NSNull αν δεν υπάρχει)
            func image(_ index: Int) -> Any {
                guard let page = doc.page(at: index) else { return NSNull() }
                let box = page.bounds(for: .mediaBox)
                let height = box.width > 0 ? width * box.height / box.width : width * 1.414
                let picture = page.thumbnail(of: CGSize(width: width, height: height), for: .mediaBox)
                return picture.jpegData(compressionQuality: 0.85)?.base64EncodedString() ?? NSNull()
            }
            call.resolve(["pages": doc.pageCount, "pageTexts": pageTexts, "cover": image(0), "page2": image(1), "locked": false])
        }
    }
}
