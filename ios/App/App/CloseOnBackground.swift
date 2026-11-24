import UIKit

/// Κλείνει μια οθόνη της εφαρμογής (προβολή αρχείου, σαρωτής) μόλις η εφαρμογή πάει στο παρασκήνιο — όταν είναι ενεργό
/// το κλείδωμα με Face ID. Η εφαρμογή κλειδώνει στο ίδιο σήμα (το «pause» του Capacitor)· χωρίς αυτό, η οθόνη θα έμενε
/// πάνω από την οθόνη κλειδώματος και θα έδειχνε το περιεχόμενο. Κρατιέται όσο είναι ανοιχτή η οθόνη (nil → σταματά).
/// API: UIApplication.didEnterBackgroundNotification (iOS 4+), NotificationCenter.addObserver(forName:object:queue:using:).
final class CloseOnBackground {
    private var token: NSObjectProtocol?

    init(enabled: Bool, close: @escaping () -> Void) {
        guard enabled else { return }
        token = NotificationCenter.default.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { _ in close() }
    }

    deinit {
        if let token { NotificationCenter.default.removeObserver(token) }
    }
}
