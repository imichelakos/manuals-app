/**
 * Κωδικός για το αντίγραφο ασφαλείας. Εξαγωγή: νέος κωδικός δύο φορές, με έλεγχο ισχύος (domain/password).
 * Εισαγωγή: ο κωδικός με τον οποίο φτιάχτηκε το αντίγραφο. Η κρυπτογράφηση γίνεται από τον καλούντα (onSubmit).
 */
import { useState } from 'react';
import { checkPassword, PASSPHRASE_MIN, PASSWORD_MIN, type PasswordProblem } from '@/domain/password';
import { t } from '@/i18n';
import { Sheet } from './Sheet';

const problemText = (p: PasswordProblem): string =>
  p === 'short' ? t('Τουλάχιστον {n} χαρακτήρες.', { n: PASSWORD_MIN })
    : p === 'variety' ? t('Βάλε 3 από τα 4: πεζά, κεφαλαία, αριθμούς, σύμβολα — ή μια φράση {n}+ χαρακτήρων.', { n: PASSPHRASE_MIN })
    : p === 'repeated' ? t('Όχι τον ίδιο χαρακτήρα ξανά και ξανά.')
    : t('Όχι ακολουθίες όπως 1234 ή qwerty.');

export function BackupPasswordSheet({ mode, onSubmit, onClose }: {
  mode: 'export' | 'import';
  /** επιστρέφει μήνυμα σφάλματος για το φύλλο (π.χ. λάθος κωδικός) ή null όταν πέτυχε */
  onSubmit: (password: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const [pw, setPw] = useState('');
  const [again, setAgain] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const check = checkPassword(pw);
  const exporting = mode === 'export';
  const mismatch = exporting && again.length > 0 && again !== pw;
  const ready = exporting ? check.ok && again === pw : pw.length > 0;

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    const err = await onSubmit(pw);
    setBusy(false);
    if (err) setError(err);
  };
  const bar = ['bg-surface-2', 'bg-bad', 'bg-warn', 'bg-ok', 'bg-ok'][check.score]!;

  return (
    <Sheet title={exporting ? t('Κωδικός για το αντίγραφο') : t('Κωδικός του αντιγράφου')} onClose={onClose} footer={
      <div className="flex gap-3">
        <button type="button" className="btn btn-plain flex-1" onClick={onClose}>{t('Άκυρο')}</button>
        <button type="submit" form="backup-pw" className="btn btn-primary flex-[2]" disabled={!ready || busy}>
          {busy ? (exporting ? t('Κρυπτογράφηση…') : t('Άνοιγμα…')) : exporting ? t('Εξαγωγή') : t('Εισαγωγή')}
        </button>
      </div>
    }>
      <form id="backup-pw" className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <p className="text-[15px] leading-relaxed text-ink-2">
          {exporting
            ? t('Το αντίγραφο κρυπτογραφείται με αυτόν τον κωδικό. Χωρίς αυτόν δεν ανοίγει από κανέναν και δεν υπάρχει επαναφορά. Φύλαξέ τον σε διαχειριστή κωδικών.')
            : t('Αυτό το αντίγραφο είναι κρυπτογραφημένο. Γράψε τον κωδικό που έβαλες στην εξαγωγή.')}
        </p>
        <div>
          <label className="label" htmlFor="bp-1">{t('Κωδικός')}</label>
          <input id="bp-1" className="input" type={show ? 'text' : 'password'} value={pw} autoFocus spellCheck={false} autoCapitalize="off" autoCorrect="off"
            autoComplete={exporting ? 'new-password' : 'current-password'} onChange={(e) => { setPw(e.target.value); setError(null); }} />
        </div>
        {exporting && (
          <>
            <div className="flex h-1.5 gap-1" aria-hidden="true">
              {[1, 2, 3, 4].map((i) => <span key={i} className={`flex-1 rounded-full ${i <= check.score ? bar : 'bg-surface-2'}`} />)}
            </div>
            {pw && check.problems.length > 0 && <ul className="space-y-0.5 text-[13px] text-warn">{check.problems.map((p) => <li key={p}>{problemText(p)}</li>)}</ul>}
            {check.ok && <p className="text-[13px] font-semibold text-ok">{t('Ισχυρός κωδικός')}</p>}
            <div>
              <label className="label" htmlFor="bp-2">{t('Ξανά ο κωδικός')}</label>
              <input id="bp-2" className="input" type={show ? 'text' : 'password'} value={again} spellCheck={false} autoCapitalize="off" autoCorrect="off"
                autoComplete="new-password" aria-invalid={mismatch} onChange={(e) => setAgain(e.target.value)} />
              {mismatch && <p className="mt-1 text-[13px] text-bad">{t('Οι δύο κωδικοί δεν είναι ίδιοι.')}</p>}
            </div>
          </>
        )}
        <label className="flex items-center gap-2 text-[14px] text-ink-2">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="size-4 accent-[var(--accent)]" />{t('Εμφάνιση κωδικού')}
        </label>
        {error && <p role="alert" className="rounded-2xl bg-bad-soft p-3 text-[14px] text-bad">{error}</p>}
      </form>
    </Sheet>
  );
}
