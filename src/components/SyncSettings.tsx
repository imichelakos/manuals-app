/** Ρυθμίσεις → Συγχρονισμός iCloud: άνοιγμα/κλείσιμο, κατάσταση, «Συγχρονισμός τώρα». */
import { isNative } from '@/services/platform';
import { setSyncEnabled, syncNow, useSyncStatus, useTooBigCount } from '@/data/syncRuntime';
import type { SyncErrorCode } from '@/data/sync';
import { getLang, t, tn } from '@/i18n';

const errorText = (code: SyncErrorCode): string =>
  code === 'no-account' ? t('Δεν υπάρχει συνδεδεμένος λογαριασμός iCloud. Συνδέσου από τις Ρυθμίσεις της συσκευής.')
    : code === 'offline' ? t('Δεν υπάρχει σύνδεση με το iCloud αυτή τη στιγμή. Θα ξαναδοκιμάσω αυτόματα.')
    : code === 'quota' ? t('Ο χώρος σου στο iCloud γέμισε. Ελευθέρωσε χώρο από τις Ρυθμίσεις της συσκευής.')
    : code === 'remote-deleted' ? t('Τα δεδομένα της εφαρμογής διαγράφηκαν από το iCloud. Ο συγχρονισμός έκλεισε· άνοιξέ τον ξανά για να ανέβουν από αυτή τη συσκευή.')
    : t('Ο συγχρονισμός απέτυχε. Δοκίμασε ξανά σε λίγο.');

const when = (ms: number) => new Intl.DateTimeFormat(getLang() === 'en' ? 'en-GB' : 'el-GR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms));

export function SyncSettings() {
  const s = useSyncStatus();
  const tooBig = useTooBigCount();
  if (s.kind === 'unsupported') {
    return <p className="text-[15px] leading-relaxed text-ink-2">{isNative
      ? t('Ο συγχρονισμός με iCloud δεν έχει ενεργοποιηθεί ακόμη σε αυτή την έκδοση. Μέχρι τότε η μεταφορά γίνεται με το αντίγραφο ασφαλείας.')
      : t('Ο συγχρονισμός με iCloud λειτουργεί στην εφαρμογή για iPhone και iPad. Εδώ η μεταφορά γίνεται με το αντίγραφο ασφαλείας.')}</p>;
  }
  const on = s.kind !== 'off' && !(s.kind === 'error' && s.code === 'remote-deleted');
  const last = 'lastSync' in s ? s.lastSync : null;
  return (
    <div>
      <div className="flex items-center gap-3">
        <button type="button" role="switch" aria-checked={on} aria-label={t('Συγχρονισμός iCloud')} onClick={() => void setSyncEnabled(!on)}
          className={`relative h-8 w-14 shrink-0 rounded-full transition ${on ? 'bg-ok' : 'bg-surface-2'}`}>
          <span className={`absolute top-1 size-6 rounded-full bg-surface shadow-card transition-all ${on ? 'left-7' : 'left-1'}`} />
        </button>
        <p className="text-[15px] font-semibold" role="status">
          {s.kind === 'off' ? t('Κλειστός') : s.kind === 'syncing' ? t('Συγχρονίζω…') : s.kind === 'error' ? t('Χρειάζεται προσοχή') : last ? t('Τελευταίος συγχρονισμός: {when}', { when: when(last) }) : t('Ανοιχτός')}
        </p>
      </div>
      {s.kind === 'error' && <p className="mt-2.5 rounded-2xl bg-warn-soft p-3 text-[14px] leading-relaxed text-warn">{errorText(s.code)}</p>}
      {on && tooBig > 0 && <p className="mt-2.5 text-[13px] leading-relaxed text-ink-2">{tn(tooBig, '{n} αρχείο δεν συγχρονίζεται επειδή ξεπερνά τα 100 MB. Μένει μόνο σε αυτή τη συσκευή.', '{n} αρχεία δεν συγχρονίζονται επειδή ξεπερνούν τα 100 MB. Μένουν μόνο σε αυτή τη συσκευή.')}</p>}
      {on && <button type="button" className="btn btn-plain mt-3" disabled={s.kind === 'syncing'} onClick={() => void syncNow()}>{t('Συγχρονισμός τώρα')}</button>}
    </div>
  );
}
