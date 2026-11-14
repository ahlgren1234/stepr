// Measures the package size reported in the README. Run after `pnpm build`.
//
// Bundle sizes use esbuild through `pnpm dlx`, so this needs network access
// the first time. esbuild isn't a dependency of the project.
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import console from 'node:console';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { brotliCompressSync, gzipSync } from 'node:zlib';

const ESBUILD = 'esbuild@0.25.12';
const ENTRIES = [
  'createTour',
  'createSpotlight',
  'createTooltip',
  'createTour, createSpotlight, createTooltip',
];

assert.ok(existsSync('dist/index.js'), 'run `pnpm build` first');

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
for (const field of [
  'dependencies',
  'peerDependencies',
  'optionalDependencies',
]) {
  const names = Object.keys(pkg[field] ?? {});
  console.log(`${field}: ${names.length ? names.join(', ') : 'none'}`);
}

const kB = (bytes) => `${(bytes / 1000).toFixed(1)} kB`;
const sizes = (code) =>
  [
    kB(code.length),
    `${kB(gzipSync(code, { level: 9 }).length)} gzip`,
    `${kB(brotliCompressSync(code).length)} brotli`,
  ].join(', ');

const [packed] = JSON.parse(
  execFileSync('npm', ['pack', '--dry-run', '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }),
);
console.log(
  `\nnpm tarball: ${kB(packed.size)} packed, ${kB(packed.unpackedSize)} unpacked, ${packed.files.length} files`,
);

const js = Buffer.concat(
  readdirSync('dist')
    .filter((name) => name.endsWith('.js'))
    .map((name) => readFileSync(`dist/${name}`)),
);
console.log(`dist/*.js, unminified: ${sizes(js)}`);

console.log(`\nMinified ESM bundle with ${ESBUILD}:`);
for (const names of ENTRIES) {
  const bundle = execFileSync(
    'pnpm',
    [
      '--silent',
      'dlx',
      ESBUILD,
      '--bundle',
      '--minify',
      '--format=esm',
      '--log-level=error',
    ],
    {
      input: `import { ${names} } from './dist/index.js'; export { ${names} };`,
      stdio: ['pipe', 'pipe', 'inherit'],
    },
  );
  console.log(`  ${`import { ${names} }`.padEnd(54)} ${sizes(bundle)}`);
}
