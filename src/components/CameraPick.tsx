/**
 * Κουμπί κάμερας για όλη την εφαρμογή: στο iPhone/iPad ανοίγει τον σαρωτή εγγράφων του iOS (VisionKit)· στο web ή
 * χωρίς υποστήριξη, την κάμερα όπως πριν (FilePick με capture). Ο καλών παίρνει πάντα το ίδιο σχήμα (ScanCapture),
 * οπότε δεν ξέρει ποιος από τους δύο δρόμους χρησιμοποιήθηκε.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { FilePick, IMAGE_TYPES } from './controls';
import { scanDocument, scannerSupported, type ScanCapture, type ScanMode } from '@/services/documentScanner';
import { expectAppSwitch } from '@/services/appSwitch';
import { toast } from './Toast';
import { t } from '@/i18n';

export function CameraPick({ mode, onCapture, className, children, disabled }: {
  mode: ScanMode; onCapture: (c: ScanCapture) => void; className?: string; children: ReactNode; disabled?: boolean;
}) {
  const [scanner, setScanner] = useState(false);
  useEffect(() => { let on = true; void scannerSupported().then((s) => { if (on) setScanner(s); }); return () => { on = false; }; }, []);

  if (!scanner) {
    // χωρίς σαρωτή: η φωτογραφία είναι και το αρχείο και η «πρώτη σελίδα»
    return (
      <FilePick accept={IMAGE_TYPES} capture disabled={disabled} className={className} onFiles={(f) => onCapture({ files: f, firstPage: f[0] ?? null, pages: f.length })}>
        {children}
      </FilePick>
    );
  }
  const open = async () => {
    expectAppSwitch();
    try {
      const c = await scanDocument(mode);
      if (c) onCapture(c);
    } catch {
      toast(t('Η σάρωση απέτυχε. Δοκίμασε ξανά.'), 'error');
    }
  };
  return <button type="button" className={className} disabled={disabled} onClick={() => void open()}>{children}</button>;
}
