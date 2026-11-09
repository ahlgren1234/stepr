// Imports the package by name so that the `exports` map and built output are
// what gets exercised. Run after `pnpm build`.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const { VERSION, createSpotlight, createTooltip, createTour } =
  await import('stepr');
assert.equal(typeof VERSION, 'string');
assert.equal(typeof createSpotlight, 'function');
assert.equal(typeof createTooltip, 'function');
assert.equal(typeof createTour, 'function');

const entry = fileURLToPath(import.meta.resolve('stepr'));
assert.ok(existsSync(entry.replace(/\.js$/, '.d.ts')), 'missing declarations');
