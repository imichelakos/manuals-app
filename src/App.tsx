/**
 * Κέλυφος της εφαρμογής. Κινητό: μία στήλη με μπάρα καρτελών κάτω. Πλατιά οθόνη (iPad, υπολογιστής): ράγα πλοήγησης,
 * η βιβλιοθήκη μόνιμα στα αριστερά και η τρέχουσα οθόνη (καρτέλα προϊόντος, σάρωση, ρυθμίσεις) δεξιά.
 */
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router';
import { useWide } from '@/hooks/useWide';
import { t } from '@/i18n';
import LibraryPanel from '@/pages/LibraryPanel';
import ItemPage from '@/pages/ItemPage';
import ScanPage from '@/pages/ScanPage';
import SettingsPage from '@/pages/SettingsPage';
import { Toasts } from '@/components/Toast';
import { LockScreen } from '@/components/LockScreen';
import { useLocked } from '@/data/appLock';
import { IconLibrary, IconScan, IconSettings } from '@/components/icons';

export default function App() {
  const wide = useWide();
  const locked = useLocked();
  const { pathname } = useLocation();
  // στη σάρωση η μπάρα καρτελών κρύβεται: μία δουλειά τη φορά
  const showTabs = !wide && !pathname.startsWith('/scan');
  return (
    <div className={wide ? 'grid h-dvh grid-cols-[5.25rem_24rem_1fr]' : ''}>
      {wide && <Rail />}
      {wide && <aside className="h-dvh overflow-y-auto border-r border-line" aria-label={t('Βιβλιοθήκη')}><LibraryPanel /></aside>}
      <main className={wide ? 'h-dvh min-w-0 overflow-y-auto' : `min-h-dvh ${showTabs ? 'pb-[calc(5.25rem+env(safe-area-inset-bottom))]' : ''}`}>
        <Routes>
          <Route path="/" element={wide ? <Welcome /> : <LibraryPanel />} />
          <Route path="/item/:id" element={<ItemPage />} />
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {showTabs && <Tabs />}
      <Toasts />
      {locked && <LockScreen />}
    </div>
  );
}

const tab = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-semibold transition ${isActive ? 'text-accent' : 'text-ink-3'}`;

/** Κινητό: μπάρα κάτω, με τη Σάρωση ως κύρια ενέργεια στο κέντρο. */
function Tabs() {
  return (
    <nav aria-label={t('Κύρια πλοήγηση')} className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/92 px-3 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg">
      <div className="mx-auto flex max-w-md items-center gap-2 py-1.5">
        <NavLink to="/" end className={tab}><IconLibrary className="text-2xl" />{t('Βιβλιοθήκη')}</NavLink>
        <NavLink to="/scan" aria-label={t('Σάρωση εντύπου')} className="-mt-7 flex size-16 shrink-0 items-center justify-center rounded-full bg-accent text-3xl text-accent-ink shadow-[0_8px_24px_-6px_var(--accent)] ring-4 ring-bg transition active:scale-95">
          <IconScan />
        </NavLink>
        <NavLink to="/settings" className={tab}><IconSettings className="text-2xl" />{t('Ρυθμίσεις')}</NavLink>
      </div>
    </nav>
  );
}

/** Πλατιά οθόνη: κάθετη ράγα στα αριστερά. */
function Rail() {
  const { pathname } = useLocation();
  const cls = (on: boolean) =>
    `flex w-full flex-col items-center gap-1 rounded-2xl py-2.5 text-[11px] font-semibold transition ${on ? 'bg-accent-soft text-accent' : 'text-ink-3 hover:bg-surface-2'}`;
  // η καρτέλα ενός προϊόντος ανήκει στη Βιβλιοθήκη
  const inLibrary = pathname === '/' || pathname.startsWith('/item/');
  return (
    <nav aria-label={t('Κύρια πλοήγηση')} className="flex h-dvh flex-col items-center gap-2 border-r border-line px-2 pb-4 pt-[calc(1rem+env(safe-area-inset-top))]">
      <NavLink to="/scan" aria-label={t('Σάρωση εντύπου')} className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-accent text-3xl text-accent-ink shadow-[0_8px_24px_-8px_var(--accent)] transition active:scale-95"><IconScan /></NavLink>
      <NavLink to="/" end className={cls(inLibrary)}><IconLibrary className="text-2xl" />{t('Βιβλιοθήκη')}</NavLink>
      <NavLink to="/settings" className={({ isActive }) => `${cls(isActive)} mt-auto`}><IconSettings className="text-2xl" />{t('Ρυθμίσεις')}</NavLink>
    </nav>
  );
}

function Welcome() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-8 text-center text-ink-3">
      <IconLibrary className="text-6xl" />
      <p className="mt-4 max-w-xs text-[15px]">{t('Διάλεξε ένα προϊόν από τη λίστα ή σκάναρε ένα νέο έντυπο.')}</p>
    </div>
  );
}
