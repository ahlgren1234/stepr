# Guidely

Framework-agnostic TypeScript package for guided tours: highlight DOM elements, describe them with a tooltip, and step through them. "Guidely" is a working name pending final naming clearance.

## Usage

### Tour

```ts
import { createTour } from 'guidely';

const tour = createTour({
  steps: [
    { target: '#save', title: 'Save', description: 'Keeps your changes.' },
    { target: document.querySelector<HTMLElement>('#share')!, title: 'Share' },
  ],
  onComplete: () => console.log('finished'),
  onExit: () => console.log('closed early'),
});

tour.start(); // returns false if no step has an available target
tour.next();
tour.previous();
tour.destroy();
```

Each step shows a spotlight and a tooltip with a step counter and Back, Next and Close buttons.

| Situation                                     | Behavior                                                                                 |
| --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `start()` while running                       | No-op; stays on the current step                                                         |
| `start()` after the tour ended                | Starts again from the first available step                                               |
| `previous()` on the first step                | No-op; the Back button is disabled                                                       |
| `next()` on the last step                     | Ends the tour and calls `onComplete`; the Next button reads Done                         |
| Close button                                  | Ends the tour and calls `onExit`                                                         |
| `destroy()`                                   | Ends the tour without a callback, since the caller already knows                         |
| `next()`, `previous()`, `destroy()` when idle | No-op                                                                                    |
| Missing, invalid or hidden target             | Step is skipped and not counted                                                          |
| No available step                             | `start()` returns `false` without callbacks                                              |
| Target disappears while shown                 | Detected on the next scroll or resize: moves to the next step, or calls `onExit` if none |

When a step is shown, its target is scrolled towards the center of the viewport, even if it was already visible. This keeps it clear of sticky headers in most layouts and leaves room for the tooltip. Tour tooltips use the theming properties listed under [Tooltip](#tooltip).

Limitations:

- Button labels and the counter are English only.
- All steps use the default spotlight and tooltip options.
- Page content stays clickable during a tour.
- Keyboard entry, Escape and dialog semantics are not implemented yet; the tooltip still has `role="tooltip"`.

### Spotlight

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

A tooltip uses the same `show`/`update`/`destroy` shape, so it can be used with a spotlight or on its own. `title` and `description` are always rendered as plain text, never as HTML. An optional `footer` element is placed below them as given.

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
