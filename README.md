# Guidely

Framework-agnostic TypeScript package for highlighting DOM elements. "Guidely" is a working name pending final naming clearance.

## Usage

```ts
import { createSpotlight } from 'guidely';

const spotlight = createSpotlight({
  padding: 8,
  overlayColor: 'rgb(0 0 0 / 50%)',
});

spotlight.show('#save-button'); // or an HTMLElement; returns false if not found
spotlight.update(); // reposition after layout changes other than scroll/resize
spotlight.destroy(); // remove the overlay and all listeners
```

## Demo

Run `pnpm build && pnpm dlx serve .` and open `/demo/`.

## Development

Requires Node.js 24 and pnpm (version pinned in `package.json`).

| Command             | Description                              |
| ------------------- | ---------------------------------------- |
| `pnpm install`      | Install dependencies                     |
| `pnpm build`        | Compile to `dist/` with declarations     |
| `pnpm test`         | Run unit tests                           |
| `pnpm test:package` | Import the built package (after `build`) |
| `pnpm lint`         | Run ESLint and check Prettier formatting |
| `pnpm format`       | Apply Prettier formatting                |
| `pnpm typecheck`    | Type-check without emitting              |
