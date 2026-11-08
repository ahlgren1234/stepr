import { expect, test } from 'vitest';
import packageJson from '../package.json' with { type: 'json' };
import { VERSION } from './index.js';

test('VERSION matches package.json', () => {
  expect(VERSION).toBe(packageJson.version);
});
