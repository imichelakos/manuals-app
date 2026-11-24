import Capacitor
import UIKit
import Vision
#if canImport(FoundationModels)
import FoundationModels
#endif

/// Αναγνώριση προϊόντος από την εικόνα του εξωφύλλου, ΧΩΡΙΣ λίστα μαρκών, μόνο στη συσκευή:
/// 1. Vision (VNRecognizeTextRequest, iOS 13+): το κείμενο ανά γραμμή, με θέση και ύψος (τα μεγάλα γράμματα είναι
///    συνήθως η μάρκα και το όνομα του προϊόντος).
/// 2. Apple Foundation Models (iOS 26+, συσκευές με Apple Intelligence): οι γραμμές → μάρκα / μοντέλο / είδος, σε
///    δομημένη μορφή (@Generable). Χωρίς διαδίκτυο, χωρίς κόστος.
/// Πρωτότυπο (23/11/2026): η status() τροφοδοτεί τη Διάγνωση, η read() τη «Δοκιμή αναγνώρισης» στο «Για δοκιμές».
@objc(ProductReaderPlugin)
public class ProductReaderPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ProductReaderPlugin"
    public let jsName = "ProductReader"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "read", returnType: CAPPluginReturnPromise),
    ]

    /// { ios, device, xcode, sdk, ai } — ai: available | deviceNotEligible | appleIntelligenceNotEnabled |
    /// modelNotReady | unavailable | osTooOld (iOS < 26) | sdkTooOld (χτίστηκε με Xcode χωρίς Foundation Models)
    @objc func status(_ call: CAPPluginCall) {
        let info = Bundle.main.infoDictionary ?? [:]
        call.resolve([
            "ios": UIDevice.current.systemVersion,
            "device": Self.deviceModel(),
            "xcode": info["DTXcode"] as? String ?? "",
            "sdk": info["DTSDKName"] as? String ?? "",
            "ai": Self.aiStatus(),
        ])
    }

    /// image: JPEG σε base64. Απάντηση: { lines: [{ text, size, top }], ocrMs, ai: { brand, model, kind } | null,
    /// aiMs, aiStatus, aiError }. size/top: ύψος και θέση της γραμμής ως κλάσμα του ύψους της εικόνας.
    @objc func read(_ call: CAPPluginCall) {
        guard let b64 = call.getString("image"), let data = Data(base64Encoded: b64),
              let image = UIImage(data: data), let cg = image.cgImage else {
            call.reject("Δεν δόθηκε εικόνα", "bad-input")
            return
        }
        let orientation = Self.orientation(image.imageOrientation)
        Task {
            let t0 = Date()
            let lines: [[String: Any]]
            do { lines = try Self.recognize(cg, orientation: orientation) } catch {
                call.reject("Η ανάγνωση κειμένου απέτυχε", "ocr-failed")
                return
            }
            let ocrMs = Int(Date().timeIntervalSince(t0) * 1000)
            var result: [String: Any] = ["lines": lines, "ocrMs": ocrMs, "ai": NSNull(), "aiMs": 0, "aiStatus": Self.aiStatus(), "aiError": NSNull()]
            #if canImport(FoundationModels)
            if #available(iOS 26.0, *), SystemLanguageModel.default.isAvailable, !lines.isEmpty {
                let t1 = Date()
                do {
                    let guess = try await Self.identify(lines)
                    result["ai"] = ["brand": guess.brand, "model": guess.model, "kind": guess.kind]
                } catch {
                    result["aiError"] = String(describing: error).prefix(300).description
                }
                result["aiMs"] = Int(Date().timeIntervalSince(t1) * 1000)
            }
            #endif
            call.resolve(result)
        }
    }

    // MARK: - Vision

    private static func recognize(_ image: CGImage, orientation: CGImagePropertyOrientation) throws -> [[String: Any]] {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true
        if #available(iOS 16.0, *) { request.automaticallyDetectsLanguage = true }
        try VNImageRequestHandler(cgImage: image, orientation: orientation, options: [:]).perform([request])
        let observations = request.results ?? []
        // από πάνω προς τα κάτω (στο Vision το y μετρά από κάτω)
        return observations
            .sorted { $0.boundingBox.maxY > $1.boundingBox.maxY }
            .compactMap { o in
                guard let text = o.topCandidates(1).first?.string, !text.trimmingCharacters(in: .whitespaces).isEmpty else { return nil }
                return ["text": text, "size": Double(o.boundingBox.height), "top": Double(1 - o.boundingBox.maxY)]
            }
    }

    // MARK: - Foundation Models

    #if canImport(FoundationModels)
    @available(iOS 26.0, *)
    @Generable
    struct ProductGuess {
        @Guide(description: "The brand or manufacturer, written as on the product, e.g. Olight, Bosch, Nissan. Logos may be misread by OCR (e.g. QOLIGHT for Olight): correct obvious OCR noise. Empty string if there is none.")
        var brand: String
        @Guide(description: "The product model: its name and/or code, e.g. Baton Turbo, Micra, WAU28PH9BY. Never the brand alone and never words like User Manual or Instructions. Empty string if there is none.")
        var model: String
        @Guide(description: "What the product is, in English, 1 to 3 words, e.g. flashlight, washing machine, car.")
        var kind: String
    }

    @available(iOS 26.0, *)
    private static func identify(_ lines: [[String: Any]]) async throws -> ProductGuess {
        // οι γραμμές με το μέγεθός τους: το μοντέλο βλέπει ποια κείμενα είναι μεγάλα (τίτλοι) και ποια μικρά
        let listing = lines.prefix(80).map { line -> String in
            let size = Int(((line["size"] as? Double) ?? 0) * 1000)
            return "[\(size)] \(line["text"] as? String ?? "")"
        }.joined(separator: "\n")
        let session = LanguageModelSession {
            "You read the OCR text of the cover of a product's user manual and identify the product."
            "Each line starts with its text height in thousandths of the page height; larger text is usually the brand or the product name."
            "Answer only from the given text. Do not invent brands or models."
        }
        let prompt = Prompt { "Cover text, top to bottom:\n\(listing)" }
        return try await session.respond(to: prompt, generating: ProductGuess.self).content
    }
    #endif

    private static func aiStatus() -> String {
        #if canImport(FoundationModels)
        if #available(iOS 26.0, *) {
            switch SystemLanguageModel.default.availability {
            case .available: return "available"
            case .unavailable(.deviceNotEligible): return "deviceNotEligible"
            case .unavailable(.appleIntelligenceNotEnabled): return "appleIntelligenceNotEnabled"
            case .unavailable(.modelNotReady): return "modelNotReady"
            default: return "unavailable"
            }
        }
        return "osTooOld"
        #else
        return "sdkTooOld"
        #endif
    }

    // MARK: - βοηθητικά

    /// π.χ. «iPhone16,1» (το εσωτερικό αναγνωριστικό του μοντέλου)
    private static func deviceModel() -> String {
        var info = utsname()
        uname(&info)
        return withUnsafeBytes(of: &info.machine) { raw in
            String(decoding: raw.prefix(while: { $0 != 0 }), as: UTF8.self)
        }
    }

    private static func orientation(_ o: UIImage.Orientation) -> CGImagePropertyOrientation {
        switch o {
        case .up: return .up
        case .down: return .down
        case .left: return .left
        case .right: return .right
        case .upMirrored: return .upMirrored
        case .downMirrored: return .downMirrored
        case .leftMirrored: return .leftMirrored
        case .rightMirrored: return .rightMirrored
        @unknown default: return .up
        }
    }
}
