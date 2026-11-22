import test from 'node:test';
import assert from 'node:assert/strict';
import { BackupCryptoError, decryptBackup, encryptBackup, isEncryptedBackup } from '@/data/backupCrypto';
import { checkPassword } from '@/domain/password';

const PW = 'Πορτοκαλί-ποδήλατο 42';

test('backupCrypto: κρυπτογράφηση → αποκρυπτογράφηση, λάθος κωδικός, αλλοιωμένη κεφαλίδα', async () => {
  const plain = new TextEncoder().encode('PK… manifest.json …') as Uint8Array<ArrayBuffer>;
  const enc = await encryptBackup(plain, PW);
  assert.ok(isEncryptedBackup(enc));
  assert.ok(!isEncryptedBackup(plain));
  assert.equal(new TextDecoder().decode(enc).includes('manifest'), false); // το περιεχόμενο δεν φαίνεται
  assert.deepEqual(await decryptBackup(enc, PW), plain);
  assert.deepEqual(await decryptBackup(enc, PW.normalize('NFD')), plain); // ίδιος κωδικός, άλλη κανονικοποίηση Unicode
  await assert.rejects(decryptBackup(enc, 'λάθος κωδικός 123'), (e: unknown) => e instanceof BackupCryptoError && e.code === 'bad-password');
  const tampered = enc.slice(); tampered[20]! ^= 1; // byte του salt
  await assert.rejects(decryptBackup(tampered, PW), (e: unknown) => e instanceof BackupCryptoError && e.code === 'bad-password');
  const hostile = enc.slice(); hostile.set([0xff, 0xff, 0xff, 0xff], 8); // 4 δισ. επαναλήψεις: απόρριψη χωρίς υπολογισμό
  await assert.rejects(decryptBackup(hostile, PW), (e: unknown) => e instanceof BackupCryptoError && e.code === 'unsupported');
  const enc2 = await encryptBackup(plain, PW);
  assert.notDeepEqual(enc2, enc); // νέο salt και iv κάθε φορά
});

test('checkPassword: κανόνες ισχύος', () => {
  assert.deepEqual(checkPassword('Abc123!').problems, ['short']);
  assert.deepEqual(checkPassword('abcdefghijklm').problems, ['variety', 'sequence']);
  assert.deepEqual(checkPassword('aaaaaaaaaaaaaaaa').problems, ['repeated']);
  assert.deepEqual(checkPassword('qwertyuiop12').problems, ['variety']);
  assert.ok(checkPassword('Kalimera-2026!').ok);              // 14, 4 είδη
  assert.ok(checkPassword('σπίτι θάλασσα βουνό').ok);          // φράση 16+
  assert.ok(!checkPassword('1234567890123456').ok);            // ακολουθία
  assert.equal(checkPassword('').score, 0);
  assert.ok(checkPassword(PW).score >= 3);
});
