import { createRequire } from 'module';
globalThis.require = createRequire(import.meta.url);
import * as esbuild from 'esbuild';
import esbuildPluginPino from 'esbuild-plugin-pino';
import fs from 'fs';

const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const external = Object.keys(pkg.dependencies || {}).filter(d => !d.startsWith('@workspace/'));
external.push(...Object.keys(pkg.devDependencies || {}).filter(d => !d.startsWith('@workspace/')));

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  external: [...external, 'pg', 'pg-hstore', 'crypto', 'events', 'stream', 'util', 'path', 'fs'],
  outdir: 'dist',
  outExtension: { '.js': '.mjs' },
  format: 'esm',
  sourcemap: true,
  plugins: [esbuildPluginPino({ transports: ['pino-pretty'] })],
});
