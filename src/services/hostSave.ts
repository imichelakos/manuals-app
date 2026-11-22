/**
 * Αποθήκευση αρχείου όταν η εφαρμογή τρέχει ως σελίδα προεπισκόπησης μέσα σε host (claude.ai Artifact): εκεί η σελίδα δεν
 * επιτρέπεται να κατεβάσει ή να ανοίξει αρχείο μόνη της — το ζητά από τον host, που ρωτά τον χρήστη. Εκτός host
 * (εφαρμογή iOS, απλός browser) δεν υπάρχει `window.claude` και η συνάρτηση επιστρέφει αμέσως false.
 */
interface HostDownloads { save(r: { filename: string; data: Blob }): Promise<{ status: string }> }
interface Host { use(name: 'downloads'): Promise<HostDownloads | null> }

export class HostSaveError extends Error {}

/** true: το ανέλαβε ο host (ο χρήστης αποδέχτηκε ή αρνήθηκε)· false: δεν υπάρχει host — συνέχισε με τον τρόπο του browser. */
export async function hostSave(blob: Blob, name: string): Promise<boolean> {
  const host = (window as unknown as { claude?: Host }).claude;
  if (typeof host?.use !== 'function') return false;
  const downloads = await host.use('downloads').catch(() => null);
  if (!downloads) return false;
  try {
    await downloads.save({ filename: name, data: blob });
  } catch (e) {
    // «declined»: ο χρήστης είπε όχι — δεν είναι σφάλμα· οτιδήποτε άλλο το βλέπει η οθόνη ως αποτυχία
    if ((e as { code?: string }).code !== 'declined') throw new HostSaveError((e as { code?: string }).code ?? 'unavailable');
  }
  return true;
}
