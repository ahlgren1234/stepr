# Guidely

Lightweight guided product tours for the web. Guidely highlights any element, explains it in a tooltip and walks people through your interface step by step.

- **Framework-agnostic:** plain DOM APIs, so it works with any framework or none.
- **No dependencies:** ESM with TypeScript declarations and no stylesheet to import.
- **Keyboard and screen reader support** built into tours.
- **Use the parts you need:** a complete tour, or just the spotlight or tooltip.

> **Pre-release:** Guidely isn't on npm yet, and "Guidely" is a working name pending final naming clearance. Until the first release, [install from a local build](#install-from-a-local-build).

## Install

```bash
npm install guidely
```

Guidely is an ES module and runs in current browsers. Importing it on a server is safe, but call `start()` and `show()` only in the browser.

### Install from a local build

```bash
git clone https://github.com/ahlgren1234/guidely.git
cd guidely
pnpm install
pnpm pack # builds and writes guidely-0.0.0.tgz

# In your project:
npm install /path/to/guidely/guidely-0.0.0.tgz
```

## Quick start

Add some elements to point at, and a button that starts the tour:

```html
<!doctype html>
<html lang="en">
  <body>
    <button id="save">Save</button>
    <button id="share">Share</button>
    <button id="start">Take the tour</button>
    <script type="module" src="/main.js"></script>
  </body>
</html>
```

Create the tour in `main.js`:

```js
import { createTour } from 'guidely';

const tour = createTour({
  steps: [
    { target: '#save', title: 'Save', description: 'Keeps your changes.' },
    { target: '#share', title: 'Share', description: 'Invites your team.' },
  ],
  onComplete: () => console.log('Finished'),
  onExit: () => console.log('Closed early'),
});

document.querySelector('#start').addEventListener('click', () => tour.start());
```

Serve it with any tool that resolves npm packages, such as `npx vite`. Without a bundler, add an import map before the module script and serve the folder over HTTP:

```html
<script type="importmap">
  { "imports": { "guidely": "/node_modules/guidely/dist/index.js" } }
</script>
```

Always use `<!doctype html>`, because viewport measurements assume standards mode.

## API

The package exports `createTour`, `createSpotlight`, `createTooltip`, the `VERSION` string and the TypeScript types for each. Targets are a CSS selector or an `HTMLElement`.

### `createTour(options)`

Each step shows a spotlight and a tooltip with a step counter and Back, Next and Close buttons.

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

| Option       | Type         | Description                                                                                    |
| ------------ | ------------ | ---------------------------------------------------------------------------------------------- |
| `steps`      | `TourStep[]` | Each step has a `target` and an optional `title` and `description`                             |
| `onComplete` | `() => void` | Called when the tour moves past its last step                                                  |
| `onExit`     | `() => void` | Called on Close or Escape, or when the current target disappears with no later step to move to |

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

When a step is shown, its target is scrolled towards the center of the viewport, even if it was already visible. This keeps it clear of sticky headers in most layouts and leaves room for the tooltip.

### `createSpotlight(options?)`

Dims the page except for one element. The overlay doesn't block clicks.

```ts
import { createSpotlight } from 'guidely';

const spotlight = createSpotlight({
  padding: 8,
  overlayColor: 'rgb(0 0 0 / 50%)',
});

spotlight.show('#save-button'); // returns false if not found
spotlight.update(); // reposition after layout changes other than scroll/resize
spotlight.destroy(); // remove the overlay and all listeners
```

| Option         | Default              | Description                                   |
| -------------- | -------------------- | --------------------------------------------- |
| `padding`      | `8`                  | Pixels between the target and the cutout edge |
| `borderRadius` | `4`                  | Corner radius of the cutout in pixels         |
| `overlayColor` | `rgba(0, 0, 0, 0.5)` | Any CSS color                                 |
| `zIndex`       | `9999`               | Stacking order of the overlay                 |

### `createTooltip(options?)`

A tooltip uses the same `show`/`update`/`destroy` shape, so it can be used with a spotlight or on its own.

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

| Option      | Default   | Description                                         |
| ----------- | --------- | --------------------------------------------------- |
| `placement` | `bottom`  | Preferred side: `top`, `right`, `bottom` or `left`  |
| `offset`    | `16`      | Pixels between the target and the tooltip           |
| `zIndex`    | `10000`   | Stacking order, above the default spotlight overlay |
| `role`      | `tooltip` | Use `dialog` if the content has controls            |

| `show()` content | Description                                                 |
| ---------------- | ----------------------------------------------------------- |
| `title`          | Rendered as plain text, never as HTML                       |
| `description`    | Rendered as plain text, never as HTML                       |
| `footer`         | An `HTMLElement` placed below the text as given             |
| `label`          | Accessible name when `role` is `dialog`. Default: the title |

If the tooltip doesn't fit on the preferred side, it flips to the opposite side, then tries the other two, and finally shifts to stay inside the viewport. `show()` returns `false` and removes the tooltip if the target is missing or the content is empty.

## Customization

Spotlight and tooltip options are listed above. Theme tooltips, including those in tours, with CSS custom properties on `:root` or any other ancestor:

| Property                          | Default                          |
| --------------------------------- | -------------------------------- |
| `--guidely-tooltip-background`    | `#fff`                           |
| `--guidely-tooltip-color`         | `#111`                           |
| `--guidely-tooltip-border-radius` | `8px`                            |
| `--guidely-tooltip-padding`       | `12px`                           |
| `--guidely-tooltip-max-width`     | `20rem`                          |
| `--guidely-tooltip-shadow`        | `0 4px 16px rgba(0, 0, 0, 0.25)` |

The tooltip has a `data-guidely-tooltip` attribute, so you can set these properties there and style the tour's buttons:

```css
[data-guidely-tooltip] {
  --guidely-tooltip-background: #0f172a;
  --guidely-tooltip-color: #f8fafc;
}

[data-guidely-tooltip] button {
  border-radius: 6px;
}
```

## Keyboard and accessibility

Tours support the following keys:

| Key               | Action                                               |
| ----------------- | ---------------------------------------------------- |
| Enter or Space    | Activates the focused Back, Next or Close button     |
| Tab and Shift+Tab | Follow the normal page order, including page content |
| Escape            | Exits the tour from anywhere on the page             |

A page handler that calls `preventDefault()` on Escape, for example to close its own popup, keeps the tour open.

- **Focus:** `start()` moves focus to the Next button, and focus stays on the activated button between steps. When the tour ends, including through `destroy()`, focus returns to the element that had it before `start()`, unless focus has since moved to another element. `onComplete` and `onExit` run after this, so they can move focus elsewhere.
- **Screen readers:** the tooltip is a non-modal `role="dialog"`, named by the step title and position and described by the step description. Later steps are announced through a visually hidden `role="status"` element.
- **Motion:** Guidely doesn't animate anything itself. Scrolling to a target follows the page's `scroll-behavior`, except that it is instant when the user prefers reduced motion.

## Known limitations

Tours:

- Button labels and the counter are English only.
- All steps use the default spotlight and tooltip options; per-step placement isn't available.
- A step whose target isn't rendered when it is reached is skipped. Guidely doesn't wait for targets, follow route changes or remember progress.
- Tours aren't coordinated, so starting two at once overlaps them.
- Page content stays clickable during a tour, and the dialog doesn't hide it from assistive technology.
- The tooltip is last in the document, so Shift+Tab leads to the end of the page and Tab past Close leaves the page. Reaching a target from the buttons can take several presses.
- Focus isn't restored into an origin inside a shadow root or iframe.

Tooltip:

- A target scrolled out of view leaves the tooltip pinned to the nearest viewport edge rather than hidden.
- If it fits on no side, the tooltip stays in the viewport and may cover the target.
- Layout changes without a scroll or resize, including changes to the tooltip's own size, need `update()`.
- The tooltip is `position: fixed` on `document.body`, so a `transform` on `body` offsets it.

## Demo

```bash
pnpm install
pnpm build
pnpm dlx serve .
```

Open `/demo/` for the documentation and demo site, or `/demo/smoke.html` for the edge-case page used in [release testing](RELEASING.md#manual-smoke-test).

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

See [RELEASING.md](RELEASING.md) for the release process.

## License

[MIT](LICENSE)
