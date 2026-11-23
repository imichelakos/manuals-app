import test from 'node:test';
import assert from 'node:assert/strict';
import { LANGS, LANG_INFO, pickLang } from '@/i18n/languages';
import { sourceUrl } from '@/domain/recyclingTips';

test('pickLang: πρώτη υποστηριζόμενη γλώσσα της συσκευής, αλλιώς αγγλικά', () => {
  assert.equal(pickLang(['de-AT', 'en-US']), 'de');
  assert.equal(pickLang(['ja-JP', 'it-IT']), 'it');
  assert.equal(pickLang(['el']), 'el');
  assert.equal(pickLang(['ja-JP']), 'en');
  assert.equal(pickLang([]), 'en');
});

test('κάθε γλώσσα έχει όνομα και locale που δέχεται το Intl', () => {
  for (const l of LANGS) {
    assert.ok(LANG_INFO[l].name);
    assert.equal(Intl.DateTimeFormat.supportedLocalesOf([LANG_INFO[l].locale]).length, 1, l);
  }
});

test('ενικός/πληθυντικός: στα γαλλικά το 0 παίρνει ενικό, στις άλλες πληθυντικό', () => {
  const one = (l: (typeof LANGS)[number], n: number) => new Intl.PluralRules(LANG_INFO[l].locale).select(n) === 'one';
  assert.equal(one('fr', 0), true);
  assert.equal(one('fr', 1), true);
  assert.equal(one('fr', 2), false);
  for (const l of ['el', 'en', 'es', 'it', 'de'] as const) { assert.equal(one(l, 0), false, l); assert.equal(one(l, 1), true, l); }
});

test('EUR-Lex: η Οδηγία ΑΗΗΕ στη γλώσσα της εφαρμογής', () => {
  assert.equal(sourceUrl('annex7', 'fr'), 'https://eur-lex.europa.eu/legal-content/FR/TXT/HTML/?uri=CELEX:32012L0019');
  assert.equal(sourceUrl('annex7', 'el'), 'https://eur-lex.europa.eu/legal-content/EL/TXT/HTML/?uri=CELEX:32012L0019');
});
