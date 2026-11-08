# Guidely

Framework-agnostic TypeScript package for highlighting DOM elements and describing them with a tooltip. "Guidely" is a working name pending final naming clearance.

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

### Tooltip

A tooltip uses the same `show`/`update`/`destroy` shape, so it can be used with a spotlight or on its own. Content is always rendered as plain text, never as HTML.

```ts
import { createSpotlight, createTooltip } from 'guidely';

const spotlight = createSpotlight();
const tooltip = createTooltip({ placement: 'bottom', offset: 16 });

// Call both, so that a missing target clears both.
spotlight.show('#save-button');
tooltip.show('#save-button', {
  title: 'Save your work',
  description: 'Changes are kept until you close the tab.',
});

spotlight.destroy();
tooltip.destroy();
```

`placement` (`top`, `right`, `bottom` or `left`; default `bottom`) is a preference. If the tooltip doesn't fit there, it flips to the opposite side, then tries the other two sides, and finally shifts to stay inside the viewport. `show()` returns `false` and removes the tooltip if the target is missing or both `title` and `description` are empty. The default `offset` of 16 clears the spotlight's default padding, and the default `zIndex` of 10000 sits above its overlay.

Theme it with CSS custom properties on the tooltip, or on any ancestor such as `:root`:

| Property                          | Default                          |
| --------------------------------- | -------------------------------- |
| `--guidely-tooltip-background`    | `#fff`                           |
| `--guidely-tooltip-color`         | `#111`                           |
| `--guidely-tooltip-border-radius` | `8px`                            |
| `--guidely-tooltip-padding`       | `12px`                           |
| `--guidely-tooltip-max-width`     | `20rem`                          |
| `--guidely-tooltip-shadow`        | `0 4px 16px rgba(0, 0, 0, 0.25)` |

The tooltip element has the `data-guidely-tooltip` attribute, so `[data-guidely-tooltip] { ... }` can set these properties.

Limitations:

- A target scrolled out of view leaves the tooltip pinned to the nearest viewport edge rather than hidden.
- If it fits on no side, the tooltip stays in the viewport and may cover the target.
- Layout changes without a scroll or resize, including changes to the tooltip's own size, need `update()`.
- Viewport measurements assume a standards-mode document (`<!doctype html>`).
- The tooltip is `position: fixed` on `document.body`, so a `transform` on `body` offsets it.

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
