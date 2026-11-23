/** Ρυθμίσεις σε ομάδες: Γενικά, Υπενθυμίσεις, Ασφάλεια, Δεδομένα — γραμμές με τίτλο αριστερά και τη ρύθμιση δεξιά. */
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useItems, wipeAll } from '@/data/library';
import { setSettings, useSettings, type Theme } from '@/data/settings';
import { resetSync } from '@/data/syncRuntime';
import { confirmIdentity } from '@/data/appLock';
import { SecuritySettings } from '@/components/SecuritySettings';
import { ReminderSettings } from '@/components/ReminderSettings';
import { cancelAllScheduled } from '@/services/notifications';
import { ENGINES, SEARCH_ENGINES, type SearchEngine } from '@/domain/manualSearch';
import { prettySize } from '@/services/files';
import { LANGS, LANG_INFO, getLang, setLang, t, tn, type Lang } from '@/i18n';
import { SyncSettings } from '@/components/SyncSettings';
import { BackupSettings } from '@/components/BackupSettings';
import { usePrefersDark } from '@/hooks/usePrefersDark';
import { Segmented } from '@/components/controls';
import { AiProbe } from '@/components/AiProbe';

declare const __APP_VERSION__: string;

/** Ομάδα ρυθμίσεων: τίτλος πάνω από την κάρτα, γραμμές μέσα (όπως στις Ρυθμίσεις του iOS). */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-1.5 px-1 text-[13px] font-bold uppercase tracking-wide text-ink-3">{title}</h2>
      <div className="card divide-y divide-line px-4">{children}</div>
    </section>
  );
}

/** Γραμμή: τίτλος (και σύντομη εξήγηση) αριστερά, η ρύθμιση δεξιά· ή από κάτω όταν δεν χωρά (`stack`). */
function Row({ title, hint, children, stack = false }: { title: string; hint?: string; children: ReactNode; stack?: boolean }) {
  return (
    <div className={`py-3 ${stack ? '' : 'flex items-center justify-between gap-3'}`}>
      <div className="min-w-0">
        <p className="text-[15px] font-semibold">{title}</p>
        {hint && <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{hint}</p>}
      </div>
      <div className={stack ? 'mt-2.5' : 'shrink-0'}>{children}</div>
    </div>
  );
}

/** Επιλογή από λίστα, μικρή, στα δεξιά της γραμμής. */
function Choice<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value as T)}
      className="max-w-[13rem] rounded-xl bg-surface-2 py-2 pl-3 pr-2 text-[15px] font-semibold text-ink outline-hidden">
      {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
    </select>
  );
}

export default function SettingsPage() {
  const s = useSettings();
  const prefersDark = usePrefersDark();
  const items = useItems();
  const [storage, setStorage] = useState<{ used: number; persisted: boolean | null } | null>(null);
  const [wipe, setWipe] = useState(false);

  useEffect(() => {
    void (async () => {
      const est = await navigator.storage?.estimate?.().catch(() => undefined);
      const persisted = (await navigator.storage?.persisted?.().catch(() => undefined)) ?? null;
      setStorage({ used: est?.usage ?? 0, persisted });
    })();
  }, [items]);


  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-[calc(1rem+env(safe-area-inset-top))]">
      <h1 className="pb-4 pt-2 text-[32px] font-extrabold leading-tight">{t('Ρυθμίσεις')}</h1>
      <div className="flex flex-col gap-6">
        <Group title={t('Γενικά')}>
          <Row title={t('Εμφάνιση')} hint={s.theme === 'auto' ? (prefersDark ? t('Τώρα: σκοτεινή') : t('Τώρα: φωτεινή')) : undefined} stack>
            <Segmented<Theme> label={t('Εμφάνιση')} value={s.theme} onChange={(theme) => setSettings({ theme })} options={[['light', t('Φωτεινή')], ['dark', t('Σκοτεινή')], ['auto', t('Αυτόματη')]]} />
          </Row>
          <Row title={t('Γλώσσα')}>
            <Choice<Lang> label={t('Γλώσσα')} value={getLang()} onChange={setLang} options={LANGS.map((l) => [l, LANG_INFO[l].name])} />
          </Row>
        </Group>

        <Group title={t('Υπενθυμίσεις')}>
          <ReminderSettings />
        </Group>

        <Group title={t('Ασφάλεια')}>
          <SecuritySettings />
        </Group>

        <Group title={t('Δεδομένα')}>
          <Row title={t('Αντίγραφο ασφαλείας')} hint={t('Κρυπτογραφημένο με κωδικό· η εισαγωγή συγχωνεύει, δεν σβήνει.')} stack>
            <BackupSettings />
          </Row>
          <Row title={t('Συγχρονισμός iCloud')} stack>
            <SyncSettings />
          </Row>
          <Row title={t('Αποθήκευση')} hint={storage?.persisted === false ? t('Ο browser μπορεί να σβήσει δεδομένα ιστοσελίδων που δεν χρησιμοποιούνται. Κράτα αντίγραφο ασφαλείας.') : undefined}>
            <p className="text-right text-[14px] text-ink-2">
              {tn(items.length, '{n} προϊόν', '{n} προϊόντα')}{storage ? ` · ${prettySize(storage.used)}` : ''}
            </p>
          </Row>
          <Row title={t('Διαγραφή όλων των δεδομένων')} hint={t('Από αυτή τη συσκευή· το iCloud δεν αγγίζεται. Δεν αναιρείται.')} stack>
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
        </Group>

        <Group title={t('Πληροφορίες')}>
          <Link to="/sources" className="flex items-center justify-between py-3 text-[15px] font-semibold">
            {t('Πηγές και υπολογισμοί')}<span className="text-ink-3" aria-hidden="true">›</span>
          </Link>
          {/* μόνο για δοκιμές: ο χρήστης δεν διαλέγει μηχανή (απόφαση 23/11/2026)· η εύρεση θα γίνεται αυτόματα */}
          <details className="py-3">
            <summary className="cursor-pointer text-[13px] font-semibold text-ink-3">{t('Για δοκιμές')}</summary>
            <Row title={t('Μηχανή αναζήτησης')}>
              <Choice<SearchEngine> label={t('Μηχανή αναζήτησης')} value={s.engine} onChange={(engine) => setSettings({ engine })} options={SEARCH_ENGINES.map((e) => [e, ENGINES[e].name])} />
            </Row>
            <AiProbe />
          </details>
        </Group>

        <p className="px-2 text-center text-[13px] leading-relaxed text-ink-3">
          {t('Η αναγνώριση κειμένου και η ανάγνωση QR γίνονται στη συσκευή. Η εφαρμογή συνδέεται στο διαδίκτυο μόνο όταν της ζητήσεις να κατεβάσει ένα PDF ή ανοίξεις έναν σύνδεσμο.')}
          <br />{t('Έκδοση {v}', { v: __APP_VERSION__ })}
        </p>
      </div>
    </div>
  );
}
