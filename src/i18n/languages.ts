/**
 * Κατάλογος γλωσσών της εφαρμογής — η μόνη θέση που τις απαριθμεί. Τα ελληνικά (el) είναι η γλώσσα-πηγή (τα κείμενα του
 * κώδικα)· κάθε άλλη έχει ένα λεξικό `<code>.ts` στον ίδιο φάκελο, που φορτώνεται μόνο όταν είναι επιλεγμένη.
 */
export const LANGS = ['el', 'en', 'fr', 'es', 'it', 'de'] as const;
export type Lang = (typeof LANGS)[number];
/** Όταν η γλώσσα της συσκευής δεν υποστηρίζεται. */
export const FALLBACK_LANG: Lang = 'en';

/** Όνομα στη δική της γλώσσα (για την επιλογή γλώσσας) και locale για ημερομηνίες, αριθμούς, ενικό/πληθυντικό. */
export const LANG_INFO: Record<Lang, { name: string; locale: string }> = {
  el: { name: 'Ελληνικά', locale: 'el-GR' },
  en: { name: 'English', locale: 'en-GB' },
  fr: { name: 'Français', locale: 'fr-FR' },
  es: { name: 'Español', locale: 'es-ES' },
  it: { name: 'Italiano', locale: 'it-IT' },
  de: { name: 'Deutsch', locale: 'de-DE' },
};

export const isLang = (v: unknown): v is Lang => (LANGS as readonly unknown[]).includes(v);

/** Πρώτη υποστηριζόμενη από τις γλώσσες της συσκευής ('de-AT' → 'de'), αλλιώς τα αγγλικά. */
export function pickLang(preferred: readonly string[]): Lang {
  for (const p of preferred) {
    const code = p.toLowerCase().split('-')[0];
    if (isLang(code)) return code;
  }
  return FALLBACK_LANG;
}
