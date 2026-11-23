import Capacitor
import UIKit
import Vision
import VisionKit

/// Ζωντανή σάρωση QR με την κάμερα (VisionKit DataScannerViewController, iOS 16+, συσκευές με A12 ή νεότερο): το QR
/// αναγνωρίζεται μόλις φανεί, χωρίς φωτογράφιση. Επιστρέφει το περιεχόμενο του πρώτου QR· η εφαρμογή αποφασίζει τι είναι.
/// APIs: DataScannerViewController(recognizedDataTypes:…), isSupported, isAvailable, startScanning(), stopScanning(),
/// DataScannerViewControllerDelegate.dataScanner(_:didAdd:allItems:), RecognizedItem.barcode, payloadStringValue.
@objc(QrScannerPlugin)
public class QrScannerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "QrScannerPlugin"
    public let jsName = "QrScanner"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isSupported", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "scan", returnType: CAPPluginReturnPromise),
    ]

    private var pending: CAPPluginCall?
    private var host: UIViewController?
    private var delegateBox: AnyObject?

    @objc func isSupported(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if #available(iOS 16.0, *) {
                call.resolve(["supported": DataScannerViewController.isSupported && DataScannerViewController.isAvailable])
            } else {
                call.resolve(["supported": false])
            }
        }
    }

    /// Απάντηση: { cancelled, value } — value: το κείμενο του QR (π.χ. διεύθυνση)
    @objc func scan(_ call: CAPPluginCall) {
        guard pending == nil else { call.reject("Ο σαρωτής είναι ήδη ανοιχτός", "busy"); return }
        DispatchQueue.main.async {
            guard #available(iOS 16.0, *), DataScannerViewController.isSupported, DataScannerViewController.isAvailable else {
                call.reject("Η ζωντανή σάρωση δεν υποστηρίζεται εδώ", "unsupported")
                return
            }
            self.pending = call
            let scanner = DataScannerViewController(recognizedDataTypes: [.barcode(symbologies: [.qr])], qualityLevel: .balanced,
                                                    recognizesMultipleItems: false, isHighFrameRateTrackingEnabled: true,
                                                    isPinchToZoomEnabled: true, isGuidanceEnabled: true, isHighlightingEnabled: true)
            let delegate = ScannerDelegate { [weak self] value in self?.finish(value) }
            self.delegateBox = delegate
            scanner.delegate = delegate
            scanner.navigationItem.leftBarButtonItem = UIBarButtonItem(systemItem: .cancel, primaryAction: UIAction { [weak self] _ in self?.finish(nil) })
            let nav = UINavigationController(rootViewController: scanner)
            nav.modalPresentationStyle = .fullScreen
            self.host = nav
            self.bridge?.viewController?.present(nav, animated: true) {
                do { try scanner.startScanning() } catch { self.finish(nil, failed: true) }
            }
        }
    }

    /// value nil: ακύρωση (ή αποτυχία με failed)
    private func finish(_ value: String?, failed: Bool = false) {
        DispatchQueue.main.async {
            guard let call = self.pending else { return }
            self.pending = nil
            if #available(iOS 16.0, *), let nav = self.host as? UINavigationController, let scanner = nav.viewControllers.first as? DataScannerViewController {
                scanner.stopScanning()
            }
            self.host?.dismiss(animated: true)
            self.host = nil
            self.delegateBox = nil
            if failed { call.reject("Η σάρωση απέτυχε", "failed") }
            else { call.resolve(["cancelled": value == nil, "value": value ?? NSNull()]) }
        }
    }
}

@available(iOS 16.0, *)
private final class ScannerDelegate: NSObject, DataScannerViewControllerDelegate {
    private let onValue: (String) -> Void
    init(onValue: @escaping (String) -> Void) { self.onValue = onValue }

    func dataScanner(_ dataScanner: DataScannerViewController, didAdd addedItems: [RecognizedItem], allItems: [RecognizedItem]) {
        for item in addedItems {
            if case .barcode(let code) = item, let value = code.payloadStringValue, !value.isEmpty {
                onValue(value)
                return
            }
        }
    }
}
