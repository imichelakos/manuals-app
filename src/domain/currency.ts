/**
 * Νομίσματα για την τιμή αγοράς: κωδικοί ISO 4217. Η λίστα είναι οι συνηθισμένες επιλογές της οθόνης· το μοντέλο δέχεται
 * οποιονδήποτε έγκυρο τριγράμματο κωδικό. Τιμή χωρίς νόμισμα (παλιές εγγραφές) σημαίνει ευρώ.
 */
export const DEFAULT_CURRENCY = 'EUR';
export const COMMON_CURRENCIES = [
  'EUR', 'USD', 'GBP', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'TRY', 'JPY', 'CNY', 'CAD', 'AUD',
] as const;
export const CURRENCY_CODE = /^[A-Z]{3}$/;

/** Το νόμισμα μιας τιμής που έχει ήδη αποθηκευτεί. */
export const currencyOf = (p: { price?: number; currency?: string }): string => p.currency ?? DEFAULT_CURRENCY;
