// Assembles the GitHub Pages site in `_site/`. Run after `pnpm build`.
//
// The demo is served from the site root, so its import of the library must stay
// inside the site: `../dist/` would resolve above a project site's subpath.
import assert from 'node:assert/strict';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';

const SOURCE_IMPORT = "from '../dist/index.js'";
const SITE_IMPORT = "from './dist/index.js'";

assert.ok(existsSync('dist/index.js'), 'run `pnpm build` first');

const demo = readFileSync('demo/index.html', 'utf8');
assert.equal(
  demo.split(SOURCE_IMPORT).length - 1,
  1,
  `expected demo/index.html to contain one ${SOURCE_IMPORT}`,
);
const page = demo.replace(SOURCE_IMPORT, SITE_IMPORT);
assert.ok(!page.includes('../'), 'demo/index.html has another parent path');

rmSync('_site', { recursive: true, force: true });
mkdirSync('_site');
writeFileSync('_site/index.html', page);
cpSync('dist', '_site/dist', {
  recursive: true,
  filter: (source) => !source.endsWith('.d.ts'),
});
