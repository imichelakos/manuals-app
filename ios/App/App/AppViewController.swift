import UIKit
import Capacitor

/// Ο κεντρικός view controller της εφαρμογής: καταχωρίζει τα δικά μας plugins (αυτά που δεν έρχονται από πακέτο npm).
class AppViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(ICloudSyncPlugin()) // συγχρονισμός μέσω iCloud (CloudKit)
        bridge?.registerPluginInstance(SecureKeyPlugin())  // κλειδί κρυπτογράφησης στο Keychain
        bridge?.registerPluginInstance(BiometricPlugin())  // Face ID / Touch ID
    }
}
