import Capacitor
import Foundation

/// Κατέβασμα ενός αρχείου (το PDF ενός εγχειριδίου ή η σελίδα που το περιέχει) από τον κώδικα iOS: χωρίς τον περιορισμό
/// CORS του WebView, με πρόοδο, πραγματική ακύρωση και όριο μεγέθους. Χωρίς cookies και χωρίς cache: κάθε κατέβασμα
/// είναι ανεξάρτητο και δεν αφήνει ίχνη. Το αρχείο γράφεται στον φάκελο Caches· η σελίδα το διαβάζει τοπικά
/// (Capacitor.convertFileSrc) και ζητά να σβηστεί με `discard`.
/// APIs: URLSessionConfiguration.ephemeral, httpShouldSetCookies, httpCookieStorage = nil, urlCache = nil,
/// URLSessionDownloadDelegate (didWriteData, didFinishDownloadingTo), URLSessionTaskDelegate.didCompleteWithError,
/// URLSessionTask.cancel() (iOS 7+).
@objc(PdfDownloadPlugin)
public class PdfDownloadPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PdfDownloadPlugin"
    public let jsName = "PdfDownload"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "download", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "discard", returnType: CAPPluginReturnPromise),
    ]

    private lazy var folder: URL = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("pdf-download", isDirectory: true)
    private lazy var session: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.httpShouldSetCookies = false
        config.httpCookieStorage = nil
        config.urlCache = nil
        config.timeoutIntervalForRequest = 60
        return URLSession(configuration: config, delegate: delegate, delegateQueue: nil)
    }()
    private lazy var delegate = DownloadDelegate(owner: self)
    /// ενεργά κατεβάσματα: αναγνωριστικό της εφαρμογής → εργασία και κλήση
    fileprivate var active: [String: (task: URLSessionDownloadTask, call: CAPPluginCall, maxBytes: Int64)] = [:]
    fileprivate let lock = NSLock()

    /// url: https · id: αναγνωριστικό της εφαρμογής (για πρόοδο και ακύρωση) · maxBytes: όριο μεγέθους.
    /// Απάντηση: { path, finalUrl, mime, size } — path: file:// URL στον φάκελο Caches.
    /// Σφάλματα: "http" (κωδικός ≠ 2xx), "too-big", "cancelled", "network", "bad-input".
    /// Γεγονός «progress»: { id, bytes, total } (total: -1 όταν ο server δεν δίνει μέγεθος).
    @objc func download(_ call: CAPPluginCall) {
        guard let raw = call.getString("url"), let url = URL(string: raw), url.scheme == "https",
              let id = call.getString("id"), !id.isEmpty else {
            call.reject("Μη έγκυρη διεύθυνση", "bad-input")
            return
        }
        let maxBytes = Int64(call.getInt("maxBytes") ?? 200 * 1024 * 1024)
        var request = URLRequest(url: url)
        request.httpShouldHandleCookies = false
        let task = session.downloadTask(with: request)
        task.taskDescription = id
        lock.lock()
        active[id] = (task, call, maxBytes)
        lock.unlock()
        task.resume()
    }

    @objc func cancel(_ call: CAPPluginCall) {
        lock.lock()
        let entry = call.getString("id").flatMap { active[$0] }
        lock.unlock()
        entry?.task.cancel()
        call.resolve()
    }

    /// Σβήνει ένα αρχείο που επέστρεψε το `download` (μόνο μέσα στον φάκελο των κατεβασμάτων).
    @objc func discard(_ call: CAPPluginCall) {
        if let raw = call.getString("path"), let url = URL(string: raw), url.isFileURL,
           url.standardizedFileURL.path.hasPrefix(folder.standardizedFileURL.path + "/") {
            try? FileManager.default.removeItem(at: url)
        }
        call.resolve()
    }

    fileprivate func take(_ id: String?) -> (task: URLSessionDownloadTask, call: CAPPluginCall, maxBytes: Int64)? {
        guard let id else { return nil }
        lock.lock()
        defer { lock.unlock() }
        return active.removeValue(forKey: id)
    }

    fileprivate func entry(_ id: String?) -> (task: URLSessionDownloadTask, call: CAPPluginCall, maxBytes: Int64)? {
        guard let id else { return nil }
        lock.lock()
        defer { lock.unlock() }
        return active[id]
    }

    /// Το προσωρινό αρχείο του URLSession σβήνεται μόλις επιστρέψει ο delegate: μεταφέρεται εδώ αμέσως.
    fileprivate func keep(_ location: URL) throws -> URL {
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        let target = folder.appendingPathComponent(UUID().uuidString)
        try FileManager.default.moveItem(at: location, to: target)
        return target
    }
}

private final class DownloadDelegate: NSObject, URLSessionDownloadDelegate {
    private weak var owner: PdfDownloadPlugin?
    /// αρχεία που ολοκληρώθηκαν, μέχρι το didCompleteWithError (εκεί απαντά η κλήση)
    private var finished: [String: URL] = [:]
    /// κατεβάσματα που σταμάτησαν επειδή ξεπέρασαν το όριο
    private var tooBig: Set<String> = []
    private let lock = NSLock()

    init(owner: PdfDownloadPlugin) { self.owner = owner }

    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didWriteData bytesWritten: Int64,
                    totalBytesWritten: Int64, totalBytesExpectedToWrite: Int64) {
        guard let owner, let id = downloadTask.taskDescription, let entry = owner.entry(id) else { return }
        if totalBytesWritten > entry.maxBytes || totalBytesExpectedToWrite > entry.maxBytes {
            lock.lock(); tooBig.insert(id); lock.unlock()
            downloadTask.cancel()
            return
        }
        owner.notifyListeners("progress", data: ["id": id, "bytes": totalBytesWritten, "total": totalBytesExpectedToWrite])
    }

    func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
        guard let owner, let id = downloadTask.taskDescription else { return }
        if let kept = try? owner.keep(location) {
            lock.lock(); finished[id] = kept; lock.unlock()
        }
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        guard let owner, let id = task.taskDescription, let entry = owner.take(id) else { return }
        lock.lock()
        let file = finished.removeValue(forKey: id)
        let overLimit = tooBig.remove(id) != nil
        lock.unlock()
        let call = entry.call
        let http = task.response as? HTTPURLResponse
        if overLimit { call.reject("Το αρχείο είναι πολύ μεγάλο", "too-big"); return }
        if let error = error as? URLError, error.code == .cancelled { call.reject("Ακυρώθηκε", "cancelled"); return }
        if error != nil { call.reject("Το κατέβασμα απέτυχε", "network"); return }
        guard let http, (200...299).contains(http.statusCode), let file else {
            if let file { try? FileManager.default.removeItem(at: file) }
            call.reject("Ο ιστότοπος απάντησε με σφάλμα", "http")
            return
        }
        let size = (try? file.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
        call.resolve([
            "path": file.absoluteString,
            "finalUrl": http.url?.absoluteString ?? task.originalRequest?.url?.absoluteString ?? "",
            "mime": http.mimeType ?? "",
            "size": size,
        ])
    }
}
