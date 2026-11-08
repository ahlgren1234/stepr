// Imports the package by name so that the `exports` map and built output are
// what gets exercised. Run after `pnpm build`.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const { VERSION, createSpotlight } = await import('guidely');
assert.equal(typeof VERSION, 'string');
assert.equal(typeof createSpotlight, 'function');

const entry = fileURLToPath(import.meta.resolve('guidely'));
assert.ok(existsSync(entry.replace(/\.js$/, '.d.ts')), 'missing declarations');
