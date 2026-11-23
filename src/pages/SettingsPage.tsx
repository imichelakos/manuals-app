/** Ρυθμίσεις: εμφάνιση, γλώσσα, αναζήτηση, προεπιλεγμένη εγγύηση, αντίγραφο ασφαλείας, συγχρονισμός, αποθήκευση. */
import { useEffect, useState, type ReactNode } from 'react';
import { exportBackup, importBackup, BackupError } from '@/data/backup';
import { useItems, wipeAll } from '@/data/library';
import { setSettings, useSettings, type Theme } from '@/data/settings';
import { resetSync } from '@/data/syncRuntime';
import { confirmIdentity } from '@/data/appLock';
import { SecuritySettings } from '@/components/SecuritySettings';
import { ReminderSettings } from '@/components/ReminderSettings';
import { cancelAllScheduled } from '@/services/notifications';
import type { SearchEngine } from '@/domain/manualSearch';
import { today } from '@/domain/dates';
import { prettySize } from '@/services/files';
import { saveFile } from '@/services/platform';
import { getLang, setLang, t, tn, type Lang } from '@/i18n';
import { FilePick } from '@/components/controls';
import { SyncSettings } from '@/components/SyncSettings';
import { toast } from '@/components/Toast';
import { IconDownload, IconUpload } from '@/components/icons';

declare const __APP_VERSION__: string;

function Row({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="py-3.5 first:pt-0 last:pb-0">
      <p className="text-[15px] font-bold">{title}</p>
      {hint && <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{hint}</p>}
      <div className="mt-2.5">{children}</div>
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-2xl bg-surface-2 p-1">
      {options.map(([v, text]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
          className={`min-h-10 rounded-xl px-4 text-sm font-semibold transition ${value === v ? 'bg-surface text-ink shadow-card' : 'text-ink-2'}`}>{text}</button>
      ))}
    </div>
  );
}

export default function SettingsPage() {
  const s = useSettings();
  const items = useItems();
  const [busy, setBusy] = useState(false);
  const [storage, setStorage] = useState<{ used: number; persisted: boolean | null } | null>(null);
  const [wipe, setWipe] = useState(false);

  useEffect(() => {
    void (async () => {
      const est = await navigator.storage?.estimate?.().catch(() => undefined);
      const persisted = (await navigator.storage?.persisted?.().catch(() => undefined)) ?? null;
      setStorage({ used: est?.usage ?? 0, persisted });
    })();
  }, [items]);

  const doExport = async () => {
    if (!(await confirmIdentity(t('Επιβεβαίωση για εξαγωγή αντιγράφου')))) return;
    setBusy(true);
    try { await saveFile(await exportBackup(), `manuals-backup-${today()}.zip`); }
    catch { toast(t('Το αντίγραφο δεν δημιουργήθηκε.'), 'error'); }
    setBusy(false);
  };
  const doImport = async (file: File) => {
    if (!(await confirmIdentity(t('Επιβεβαίωση για εισαγωγή αντιγράφου')))) return;
    setBusy(true);
    try {
      const r = await importBackup(file);
      toast(`${tn(r.added, '{n} νέο προϊόν', '{n} νέα προϊόντα')} · ${tn(r.updated, '{n} ενημερώθηκε', '{n} ενημερώθηκαν')}`);
    } catch (e) {
      const code = e instanceof BackupError ? e.code : 'not-backup';
      toast(code === 'too-big' ? t('Το αρχείο είναι πολύ μεγάλο.') : code === 'newer-version' ? t('Το αντίγραφο είναι από νεότερη έκδοση της εφαρμογής.') : t('Αυτό δεν είναι αντίγραφο ασφαλείας της εφαρμογής.'), 'error');
    }
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-[calc(1rem+env(safe-area-inset-top))]">
      <h1 className="pb-4 pt-2 text-[32px] font-extrabold leading-tight">{t('Ρυθμίσεις')}</h1>
      <div className="flex flex-col gap-4">
        <section className="card divide-y divide-line p-5">
          <Row title={t('Εμφάνιση')}>
            <Segmented<Theme> label={t('Εμφάνιση')} value={s.theme} onChange={(theme) => setSettings({ theme })} options={[['auto', t('Όπως η συσκευή')], ['light', t('Φωτεινή')], ['dark', t('Σκοτεινή')]]} />
          </Row>
          <Row title={t('Γλώσσα')}>
            <Segmented<Lang> label={t('Γλώσσα')} value={getLang()} onChange={setLang} options={[['el', 'Ελληνικά'], ['en', 'English']]} />
          </Row>
        </section>

        <section className="card p-5">
          <Row title={t('Ασφάλεια')}>
            <SecuritySettings />
          </Row>
        </section>

        <section className="card divide-y divide-line p-5">
          <Row title={t('Μηχανή αναζήτησης')} hint={t('Όταν ψάχνεις το ψηφιακό εγχειρίδιο, η αναζήτηση ανοίγει εδώ.')}>
            <Segmented<SearchEngine> label={t('Μηχανή αναζήτησης')} value={s.engine} onChange={(engine) => setSettings({ engine })} options={[['duckduckgo', 'DuckDuckGo'], ['google', 'Google']]} />
          </Row>
          <Row title={t('Συνήθης διάρκεια εγγύησης')} hint={t('Εμφανίζεται ως γρήγορη επιλογή στην καρτέλα κάθε προϊόντος.')}>
            <Segmented label={t('Συνήθης διάρκεια εγγύησης')} value={String(s.warrantyMonths)} onChange={(v) => setSettings({ warrantyMonths: Number(v) })}
              options={[['12', t('1 χρόνος')], ['24', t('{n} χρόνια', { n: 2 })], ['36', t('{n} χρόνια', { n: 3 })], ['60', t('{n} χρόνια', { n: 5 })]]} />
          </Row>
          <Row title={t('Υπενθύμιση λήξης εγγύησης')} hint={t('Ειδοποίηση στη συσκευή πριν λήξει μια εγγύηση και την ημέρα της λήξης, στις 10:00. Η ειδοποίηση δείχνει το όνομα του προϊόντος.')}>
            <ReminderSettings />
          </Row>
        </section>

        <section className="card divide-y divide-line p-5">
          <Row title={t('Αντίγραφο ασφαλείας')} hint={t('Ένα αρχείο .zip με όλα τα προϊόντα και τα αρχεία τους. Με αυτό μεταφέρεις τη βιβλιοθήκη και σε άλλη συσκευή: η εισαγωγή συγχωνεύει, δεν σβήνει. Το αρχείο δεν είναι κρυπτογραφημένο — φύλαξέ το σε ασφαλές μέρος.')}>
            <div className="grid grid-cols-2 gap-2.5">
              <button type="button" className="btn btn-plain" disabled={busy || items.length === 0} onClick={() => void doExport()}><IconDownload className="text-xl" />{t('Εξαγωγή')}</button>
              <FilePick accept=".zip,application/zip" disabled={busy} onFiles={(f) => void doImport(f[0]!)} className="btn btn-plain"><IconUpload className="text-xl" />{t('Εισαγωγή')}</FilePick>
            </div>
          </Row>
          <Row title={t('Συγχρονισμός iCloud')} hint={t('Τα προϊόντα και τα αρχεία σου αποθηκεύονται στον ιδιωτικό χώρο iCloud του Apple ID σου και εμφανίζονται σε όλες τις συσκευές σου. Μετρούν στον αποθηκευτικό σου χώρο iCloud.')}>
            <SyncSettings />
          </Row>
        </section>

        <section className="card divide-y divide-line p-5">
          <Row title={t('Αποθήκευση')} hint={t('Τα δεδομένα αποθηκεύονται κρυπτογραφημένα σε αυτή τη συσκευή.')}>
            <p className="text-[15px] text-ink-2">
              {tn(items.length, '{n} προϊόν', '{n} προϊόντα')}{storage ? ` · ${prettySize(storage.used)}` : ''}
              {storage?.persisted === true && <span className="badge badge-ok ml-2">{t('Μόνιμη αποθήκευση')}</span>}
              {storage?.persisted === false && <span className="badge badge-warn ml-2">{t('Όχι μόνιμη')}</span>}
            </p>
            {storage?.persisted === false && <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{t('Ο browser μπορεί να σβήσει δεδομένα ιστοσελίδων που δεν χρησιμοποιούνται. Πρόσθεσε την εφαρμογή στην οθόνη Αφετηρίας και κράτα αντίγραφο ασφαλείας.')}</p>}
          </Row>
          <Row title={t('Διαγραφή όλων των δεδομένων')} hint={t('Σβήνει όλα τα προϊόντα και τα αρχεία από αυτή τη συσκευή και κλείνει τον συγχρονισμό. Ό,τι υπάρχει στο iCloud δεν σβήνεται. Δεν αναιρείται.')}>
            {wipe ? (
              <div className="flex gap-2.5">
                <button type="button" className="btn btn-plain flex-1" onClick={() => setWipe(false)}>{t('Άκυρο')}</button>
                <button type="button" className="btn btn-danger flex-1" onClick={() => void (async () => {
                  if (!(await confirmIdentity(t('Επιβεβαίωση για διαγραφή όλων των δεδομένων')))) return;
                  await resetSync();
                  await cancelAllScheduled();
                  await wipeAll();
                  location.reload(); // νέο κλειδί κρυπτογράφησης στην εκκίνηση
                })()}>{t('Ναι, διαγραφή όλων')}</button>
              </div>
            ) : <button type="button" className="btn btn-danger" disabled={items.length === 0} onClick={() => setWipe(true)}>{t('Διαγραφή όλων')}</button>}
          </Row>
        </section>

        <p className="px-2 text-center text-[13px] leading-relaxed text-ink-3">
          {t('Η αναγνώριση κειμένου και η ανάγνωση QR γίνονται στη συσκευή. Η εφαρμογή συνδέεται στο διαδίκτυο μόνο όταν της ζητήσεις να κατεβάσει ένα PDF ή ανοίξεις έναν σύνδεσμο.')}
          <br />{t('Έκδοση {v}', { v: __APP_VERSION__ })}
        </p>
      </div>
    </div>
  );
}
