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
| Close button or Escape                        | Ends the tour and calls `onExit`                                                         |
| `destroy()`                                   | Ends the tour without a callback, since the caller already knows                         |
| `next()`, `previous()`, `destroy()` when idle | No-op                                                                                    |
| Missing, invalid or hidden target             | Step is skipped and not counted                                                          |
| No available step                             | `start()` returns `false` without callbacks                                              |
| Target disappears while shown                 | Detected on the next scroll or resize: moves to the next step, or calls `onExit` if none |

When a step is shown, its target is scrolled towards the center of the viewport, even if it was already visible. This keeps it clear of sticky headers in most layouts and leaves room for the tooltip. Tour tooltips use the theming properties listed under [Tooltip](#tooltip).

#### Accessibility

- **Focus:** `start()` moves focus to the Next button, and focus stays on the activated button between steps. When the tour ends, including through `destroy()`, focus returns to the element that had it before `start()`, unless focus has since moved to another element. `onComplete` and `onExit` run after this, so they can move focus elsewhere.
- **Keyboard:** Tab and Shift+Tab follow the normal page order, so focus can leave the tour's buttons and reach page content, including a focusable target. Enter or Space activates the buttons. Escape exits from anywhere on the page; a page handler that calls `preventDefault()` on the key, for example to close its own popup, keeps the tour open.
- **Screen readers:** the tooltip is a non-modal `role="dialog"`, named by the step title and position and described by the step description. Later steps are announced through a visually hidden `role="status"` element.
- **Motion:** Guidely doesn't animate anything itself. Scrolling to a target follows the page's `scroll-behavior`, except that it is instant when the user prefers reduced motion.

Limitations:

- Button labels and the counter are English only.
- All steps use the default spotlight and tooltip options.
- Page content stays clickable during a tour, and the dialog doesn't hide it from assistive technology.
- The tooltip is last in the document, so Shift+Tab leads to the end of the page and Tab past Close leaves the page. Reaching a target from the buttons can take several presses.
- Focus isn't restored into an origin inside a shadow root or iframe.

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

A tooltip uses the same `show`/`update`/`destroy` shape, so it can be used with a spotlight or on its own. `title` and `description` are always rendered as plain text, never as HTML. An optional `footer` element is placed below them as given. Pass `role: 'dialog'` to `createTooltip` if the footer has controls; the dialog is then named by `title`, or by `label` in the content if given, and described by `description`.

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

### Manual smoke checklist

Run this in one current browser before a release, using only the keyboard from step 1 to 6.

1. Tab to **Start tour** and press Enter. The first step appears and Next has a focus ring.
2. Press Shift+Tab repeatedly until focus reaches a page button, then Tab back to Next. Focus leaves the tooltip and returns, the tour stays open, and Back is skipped on the first step.
3. Press Enter on Next until the nested card. Each target is highlighted, the tooltip is readable, and focus stays on Next. The last step reads Done.
4. Press Shift+Tab to Back and press Enter until the first step. When Back becomes disabled, focus moves to Next.
5. Press Escape. The tour disappears, the page shows `onExit called`, and focus is back on **Start tour**.
6. Start again and press Enter through to Done. The page shows `onComplete called`, and focus is back on **Start tour**.
7. Emulate reduced motion (in Chrome DevTools: Rendering > Emulate CSS media feature `prefers-reduced-motion`), reload and start the tour. Moving between steps jumps instantly instead of scrolling smoothly.
8. Required before release, and not covered by automated checks: with NVDA, start the tour. It announces the dialog with the title, step position and description, and each button by name. Pressing Next announces the new step.

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
