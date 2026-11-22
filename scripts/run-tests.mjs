// Τρέχει όλα τα tests/*.test.ts: esbuild (bundle για node, alias @ → src) και μετά ο ενσωματωμένος δρομέας του Node.
import { build } from 'esbuild';
import { readdirSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const out = '.test-build'; // εκτός node_modules: ο δρομέας του Node αγνοεί ό,τι βρίσκεται εκεί
mkdirSync(out, { recursive: true });
const only = process.argv[2];
const files = readdirSync('tests').filter((f) => f.endsWith('.test.ts') && (!only || f.includes(only)));
await build({
  entryPoints: files.map((f) => `tests/${f}`), outdir: out, bundle: true, platform: 'node', format: 'cjs',
  outExtension: { '.js': '.cjs' }, alias: { '@': './src' }, logLevel: 'warning', define: { 'import.meta.env': '{}' },
});
const r = spawnSync(process.execPath, ['--test', ...files.map((f) => `${out}/${f.replace(/\.ts$/, '.cjs')}`)], { stdio: 'inherit' });
process.exit(r.status ?? 1);
