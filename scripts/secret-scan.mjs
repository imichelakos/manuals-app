// Secret scan (stand-in for GitHub secret scanning, not available on private repos of a personal account).
// Same script as imichelakos/gf-smart-choice-site scripts/secret-scan.mjs (adapted from gf-smart-choice gf-app).
//   node scripts/secret-scan.mjs            all tracked files (CI, every push)
//   node scripts/secret-scan.mjs --staged   only what goes into the commit (.githooks/pre-commit)
// Fails (exit 1) on private keys, known provider tokens and forbidden files (keys, credentials, .env).
import { execFileSync } from 'node:child_process';

const staged = process.argv.includes('--staged');
const top = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const git = (...a) => execFileSync('git', a, { cwd: top, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
const files = (staged ? git('diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z') : git('ls-files', '-z')).split('\0').filter(Boolean);

const FORBIDDEN_FILES = [
  [/(^|\/)keys\//, 'keys folder'], [/\.(pem|p12|pfx|key|mobileprovision|p8)$/i, 'key/certificate file'],
  [/github-recovery-codes/i, 'recovery codes'], [/(^|\/)\.env(\.|$)/, '.env file'],
];
const PATTERNS = [
  [/-----BEGIN (RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/, 'private key (PEM)'],
  [/\bgh[pousr]_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{60,}/, 'GitHub token'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key'], [/\bxox[abpors]-[A-Za-z0-9-]{10,}/, 'Slack token'],
  [/\bsk-(ant-)?[A-Za-z0-9_-]{32,}/, 'API key (OpenAI/Anthropic)'], [/\bAIza[0-9A-Za-z_-]{35}\b/, 'Google API key'],
  [/\b(sk|rk)_live_[0-9a-zA-Z]{20,}/, 'Stripe live key'], [/\bv1\.0-[0-9a-f]{24,}|\b[A-Za-z0-9_-]{40}\.cfat\b/i, 'Cloudflare token'],
  [/(password|passwd|secret|api[_-]?key|token)\s*[:=]\s*["'][^"'\s$]{12,}["']/i, 'password/secret in code'],
];
const ALLOW = [/^scripts\/secret-scan\.mjs$/];

const bad = [];
for (const f of files) {
  if (ALLOW.some((r) => r.test(f))) continue;
  for (const [re, what] of FORBIDDEN_FILES) if (re.test(f)) bad.push(`${f}: ${what}`);
  let text;
  try { text = staged ? git('show', `:${f}`) : git('show', `HEAD:${f}`); } catch { bad.push(`${f}: could not be read (fail-closed)`); continue; }
  if (text.length > 20_000_000 || text.includes('\0')) continue; // binary / very large
  text.split('\n').forEach((line, i) => {
    for (const [re, what] of PATTERNS) if (re.test(line)) bad.push(`${f}:${i + 1}: ${what}`);
  });
}
if (bad.length) {
  console.error(`✗ possible secrets (${bad.length}):\n  ${bad.slice(0, 50).join('\n  ')}`);
  console.error('If this is a false positive, add a justified exception to ALLOW in scripts/secret-scan.mjs.');
  process.exit(1);
}
console.log(`✓ no secrets in ${files.length} files${staged ? ' (commit)' : ''}`);
