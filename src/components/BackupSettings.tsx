/**
 * Ρυθμίσεις → Αντίγραφο ασφαλείας: εξαγωγή (πάντα κρυπτογραφημένη με κωδικό) και εισαγωγή (κρυπτογραφημένο .mbackup ή
 * παλιό .zip). Και οι δύο ζητούν πρώτα επιβεβαίωση ταυτότητας (Face ID), όταν το κλείδωμα είναι ενεργό.
 */
import { useState } from 'react';
import { BACKUP_EXTENSION, BackupError, backupNeedsPassword, exportBackup, importBackup, type ImportResult } from '@/data/backup';
import { useItems } from '@/data/library';
import { confirmIdentity } from '@/data/appLock';
import { today } from '@/domain/dates';
import { saveFile } from '@/services/platform';
import { t, tn } from '@/i18n';
import { FilePick } from './controls';
import { toast } from './Toast';
import { BackupPasswordSheet } from './BackupPasswordSheet';
import { IconDownload, IconUpload } from './icons';

const errorText = (code: BackupError['code']): string =>
  code === 'too-big' ? t('Το αρχείο είναι πολύ μεγάλο.')
    : code === 'newer-version' ? t('Το αντίγραφο είναι από νεότερη έκδοση της εφαρμογής.')
    : code === 'bad-password' ? t('Λάθος κωδικός — ή το αρχείο έχει αλλοιωθεί.')
    : t('Αυτό δεν είναι αντίγραφο ασφαλείας της εφαρμογής.');

const done = (r: ImportResult) => toast(`${tn(r.added, '{n} νέο προϊόν', '{n} νέα προϊόντα')} · ${tn(r.updated, '{n} ενημερώθηκε', '{n} ενημερώθηκαν')}`);

export function BackupSettings() {
  const items = useItems();
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<{ mode: 'export' } | { mode: 'import'; file: File } | null>(null);

  const startExport = async () => {
    if (await confirmIdentity(t('Επιβεβαίωση για εξαγωγή αντιγράφου'))) setSheet({ mode: 'export' });
  };
  const startImport = async (file: File) => {
    if (!(await confirmIdentity(t('Επιβεβαίωση για εισαγωγή αντιγράφου')))) return;
    if (await backupNeedsPassword(file)) { setSheet({ mode: 'import', file }); return; }
    setBusy(true);
    try { done(await importBackup(file)); } catch (e) { toast(errorText(e instanceof BackupError ? e.code : 'not-backup'), 'error'); }
    setBusy(false);
  };

  /** από το φύλλο κωδικού: null όταν πέτυχε (το φύλλο κλείνει), αλλιώς το μήνυμα που δείχνει */
  const submit = async (password: string): Promise<string | null> => {
    if (!sheet) return null;
    try {
      if (sheet.mode === 'export') await saveFile(await exportBackup(password), `manuals-backup-${today()}.${BACKUP_EXTENSION}`);
      else done(await importBackup(sheet.file, password));
      setSheet(null);
      return null;
    } catch (e) {
      if (sheet.mode === 'export') return t('Το αντίγραφο δεν δημιουργήθηκε.');
      const code = e instanceof BackupError ? e.code : 'not-backup';
      if (code !== 'bad-password') { setSheet(null); toast(errorText(code), 'error'); return null; }
      return errorText(code);
    }
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" className="btn btn-plain" disabled={busy || items.length === 0} onClick={() => void startExport()}><IconDownload className="text-xl" />{t('Εξαγωγή')}</button>
        <FilePick accept={`.${BACKUP_EXTENSION},.zip,application/zip,application/octet-stream`} disabled={busy} onFiles={(f) => void startImport(f[0]!)} className="btn btn-plain"><IconUpload className="text-xl" />{t('Εισαγωγή')}</FilePick>
      </div>
      {sheet && <BackupPasswordSheet mode={sheet.mode} onSubmit={submit} onClose={() => setSheet(null)} />}
    </>
  );
}
