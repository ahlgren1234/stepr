# Stepr

Lightweight guided product tours for the web. Stepr highlights any element, explains it in a tooltip and walks people through your interface step by step.

- **Framework-agnostic:** plain DOM APIs, so it works with any framework or none.
- **No runtime dependencies:** ESM with TypeScript declarations and no stylesheet to import. The whole library is 2.8 kB minified and gzipped ([measured](#package-size)).
- **Keyboard support and dialog semantics** built into tours. See [what has been tested](#accessibility-testing).
- **Use the parts you need:** a complete tour, or just the spotlight or tooltip.

**[Try the live demo](https://ahlgren1234.github.io/stepr/)**

## Install

```bash
npm install stepr
```

Stepr is an ES module for the browser; see [browser support](#browser-support). Importing it and calling `createTour`, `createSpotlight` or `createTooltip` on a server is safe, because nothing touches the DOM until `start()` or `show()`, which must run in the browser.

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
import { createTour } from 'stepr';

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
  { "imports": { "stepr": "/node_modules/stepr/dist/index.js" } }
</script>
```

Always use `<!doctype html>`, because viewport measurements assume standards mode.

## React and Vue

Stepr has no framework bindings; use the same API from a component. Create the tour once, start it from an event handler, and call `destroy()` when the component unmounts so that a tour that is still open is removed with it. `destroy()` doesn't call `onComplete` or `onExit`.

### React

```tsx
import { useEffect, useRef } from 'react';
import { createTour, type Tour } from 'stepr';

export function TourButton() {
  const tour = useRef<Tour | null>(null);

  useEffect(() => {
    const instance = createTour({
      steps: [
        { target: '#save', title: 'Save', description: 'Keeps your changes.' },
        { target: '#share', title: 'Share', description: 'Invites your team.' },
      ],
      onComplete: () => console.log('Finished'),
      onExit: () => console.log('Closed early'),
    });
    tour.current = instance;
    return () => {
      instance.destroy();
      tour.current = null;
    };
  }, []);

  return (
    <button type="button" onClick={() => tour.current?.start()}>
      Take the tour
    </button>
  );
}
```

The effect cleanup also covers React's development-mode Strict Mode, which mounts, unmounts and remounts the component.

### Vue

```vue
<script setup lang="ts">
import { onBeforeUnmount } from 'vue';
import { createTour } from 'stepr';

const tour = createTour({
  steps: [
    { target: '#save', title: 'Save', description: 'Keeps your changes.' },
    { target: '#share', title: 'Share', description: 'Invites your team.' },
  ],
  onComplete: () => console.log('Finished'),
  onExit: () => console.log('Closed early'),
});

onBeforeUnmount(() => tour.destroy());
</script>

<template>
  <button type="button" @click="tour.start()">Take the tour</button>
</template>
```

Creating the tour in `setup` is safe during server-side rendering, because it doesn't touch the DOM until `start()`.

### Things to know in any framework

- Options are read once. To change the steps or callbacks, destroy the tour and create a new one, for example by listing the values as effect dependencies in React.
- Selector targets are looked up when the tour starts and each time it changes step, so the elements must be rendered by then. A step whose target isn't rendered is skipped. Selectors are simpler than element refs, which can go stale when a framework replaces the element.
- Stepr adds its overlay and tooltip to `document.body`, outside your component tree, and styles them inline. Theme them with the [CSS custom properties](#customization).

## API

Everything is exported from `stepr`; there are no other entry points.

| Export            | Kind                | Description                                                        |
| ----------------- | ------------------- | ------------------------------------------------------------------ |
| `createTour`      | function            | A sequence of steps, each with a spotlight, a tooltip and controls |
| `createSpotlight` | function            | Dims the page except for one element                               |
| `createTooltip`   | function            | Places text next to an element                                     |
| `VERSION`         | `string`            | The package version, for example `'0.1.0'`                         |
| Types             | TypeScript (`type`) | `Tour`, `TourOptions`, `TourStep`                                  |
|                   |                     | `Spotlight`, `SpotlightOptions`, `SpotlightTarget`                 |
|                   |                     | `Tooltip`, `TooltipContent`, `TooltipOptions`, `TooltipPlacement`  |

A target (`SpotlightTarget`) is a CSS selector or an `HTMLElement`. A selector is resolved with `document.querySelector`, so the first match is used, and an invalid selector is treated like one that matches nothing. A target is available if it is in the document and has a layout box with a width or height, so `display: none` targets count as missing but `visibility: hidden` or `opacity: 0` targets don't.

### `createTour(options)`

Each step shows a spotlight and a tooltip with a step counter and Back, Next and Close buttons.

```ts
import { createTour } from 'stepr';

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

| Option       | Type                  | Description                                                                                   |
| ------------ | --------------------- | --------------------------------------------------------------------------------------------- |
| `steps`      | `readonly TourStep[]` | Required. The steps in order                                                                  |
| `onComplete` | `() => void`          | Optional. Called when the tour moves past its last step                                       |
| `onExit`     | `() => void`          | Optional. Called on Close or Escape, or when the current target disappears with no later step |

| `TourStep` field | Type              | Description                                                          |
| ---------------- | ----------------- | -------------------------------------------------------------------- |
| `target`         | `SpotlightTarget` | Required. The element to highlight                                   |
| `title`          | `string`          | Optional. Shown in bold and used in the dialog's name                |
| `description`    | `string`          | Optional. Shown below the title and used as the dialog's description |

Titles and descriptions are rendered as plain text, never as HTML.

| Method       | Returns   | Description                                                                                        |
| ------------ | --------- | -------------------------------------------------------------------------------------------------- |
| `start()`    | `boolean` | Shows the first available step and focuses Next. `false` if no step is available, `true` otherwise |
| `next()`     | `void`    | Same as the Next button: moves to the next available step, or completes the tour after the last    |
| `previous()` | `void`    | Same as the Back button: moves to the previous available step                                      |
| `destroy()`  | `void`    | Removes the tour's elements and listeners without calling a callback. The tour can start again     |

`onComplete` and `onExit` run after the tour has removed itself and restored focus, so they can start it again or move focus elsewhere.

| Situation                                     | Behavior                                                                                 |
| --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `start()` while running                       | Returns `true` and stays on the current step                                             |
| `start()` after the tour ended                | Starts again from the first available step                                               |
| `previous()` on the first step                | No-op; the Back button is disabled                                                       |
| `next()` on the last step                     | Ends the tour and calls `onComplete`; the Next button reads Done                         |
| Close button or Escape                        | Ends the tour and calls `onExit`                                                         |
| `destroy()`                                   | Ends the tour without a callback, since the caller already knows                         |
| `next()`, `previous()`, `destroy()` when idle | No-op                                                                                    |
| Missing, invalid or `display: none` target    | Step is skipped and not counted                                                          |
| No available step                             | `start()` returns `false` without callbacks                                              |
| Target disappears while shown                 | Detected on the next scroll or resize: moves to the next step, or calls `onExit` if none |

When a step is shown, its target is scrolled towards the center of the viewport, even if it was already visible. This keeps it clear of sticky headers in most layouts and leaves room for the tooltip.

### `createSpotlight(options?)`

Dims the page except for one element. The overlay doesn't block clicks.

```ts
import { createSpotlight } from 'stepr';

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

| Method         | Returns   | Description                                                                                                             |
| -------------- | --------- | ----------------------------------------------------------------------------------------------------------------------- |
| `show(target)` | `boolean` | Highlights the target, replacing any current highlight. `false`, and the overlay removed, if the target isn't available |
| `update()`     | `void`    | Repositions the cutout. Removes the overlay if the target has been removed or has lost its size                         |
| `destroy()`    | `void`    | Removes the overlay and its listeners. `show()` can be called again                                                     |

The cutout follows scrolling, including in nested scroll containers, and window resizes. The overlay is `aria-hidden`, has a `data-stepr-spotlight` attribute and doesn't scroll the target into view.

### `createTooltip(options?)`

A tooltip uses the same `show`/`update`/`destroy` shape, so it can be used with a spotlight or on its own.

```ts
import { createSpotlight, createTooltip } from 'stepr';

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

All content fields are optional, but at least one of `title`, `description` and `footer` is needed.

| Method                  | Returns   | Description                                                                                                                                                  |
| ----------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `show(target, content)` | `boolean` | Shows the content next to the target, replacing any current tooltip. `false`, and the tooltip removed, if the target isn't available or the content is empty |
| `update()`              | `void`    | Repositions the tooltip. Removes it if the target has been removed or has lost its size                                                                      |
| `destroy()`             | `void`    | Removes the tooltip and its listeners. `show()` can be called again                                                                                          |

If the tooltip doesn't fit on the preferred side, it flips to the opposite side, then tries the other two, and finally shifts to stay inside the viewport. It follows scrolling and window resizes, like the spotlight, and doesn't scroll the target into view.

A standalone tooltip only displays content. It doesn't open on hover or focus, doesn't close on Escape, and doesn't add `aria-describedby` to its target. Add that wiring yourself if you need it. With `role: 'dialog'`, it is named by `label` and described by `description`.

## Customization

Spotlight and tooltip options are listed above. Theme tooltips, including those in tours, with CSS custom properties on `:root` or any other ancestor:

| Property                        | Default                          |
| ------------------------------- | -------------------------------- |
| `--stepr-tooltip-background`    | `#fff`                           |
| `--stepr-tooltip-color`         | `#111`                           |
| `--stepr-tooltip-border-radius` | `8px`                            |
| `--stepr-tooltip-padding`       | `12px`                           |
| `--stepr-tooltip-max-width`     | `20rem`                          |
| `--stepr-tooltip-shadow`        | `0 4px 16px rgba(0, 0, 0, 0.25)` |

The tooltip has a `data-stepr-tooltip` attribute, so you can set these properties there and style the tour's buttons:

```css
[data-stepr-tooltip] {
  --stepr-tooltip-background: #0f172a;
  --stepr-tooltip-color: #f8fafc;
}

[data-stepr-tooltip] button {
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
- **Motion:** Stepr doesn't animate anything itself. Scrolling to a target follows the page's `scroll-behavior`, except that it is instant when the user prefers reduced motion.

The spotlight and standalone tooltip have no keyboard handling of their own; see [`createTooltip`](#createtooltipoptions).

### Accessibility testing

What has been checked, and how:

- **Automated:** unit tests check the dialog's role, name and description, the status announcements, focus movement and restoration, and Escape handling. They run in [happy-dom](https://github.com/capricorn86/happy-dom), so they check the DOM that assistive technology reads, not what it says.
- **Keyboard:** the [manual smoke test](RELEASING.md#manual-smoke-test) passed for v0.1.0 in one browser, as reported by the maintainer. The browser and version weren't recorded.
- **Screen reader:** the [NVDA test on Windows](RELEASING.md#nvda-test-on-windows) passed for v0.1.0, as reported by the maintainer. It covers the tour on the smoke-test page only. The NVDA, browser and Windows versions weren't recorded.

Nothing else has been tested: no other screen reader (such as VoiceOver, JAWS, Narrator or TalkBack), no mobile or touch device, and no Windows high contrast or other forced colors mode. Stepr hasn't been audited against WCAG.

## Package size

Stepr has no `dependencies`, `peerDependencies` or `optionalDependencies`. Measured for v0.1.0:

| What                                            | Minified | Gzip   | Brotli |
| ----------------------------------------------- | -------- | ------ | ------ |
| `import { createTour }`, or all three functions | 6.2 kB   | 2.8 kB | 2.5 kB |
| `import { createTooltip }`                      | 2.7 kB   | 1.3 kB | 1.2 kB |
| `import { createSpotlight }`                    | 1.4 kB   | 0.8 kB | 0.7 kB |

Bundles are built from `dist/` with esbuild 0.25.12 and compressed with gzip level 9 and default Brotli. A tour includes the spotlight and tooltip, and the package is marked `sideEffects: false`, so bundlers leave out what you don't import. The files in `dist/` are not minified. To reproduce the numbers, along with the npm tarball size, run `pnpm build && pnpm size` in a clone of this repository.

## Browser support

No browser support matrix has been tested. The v0.1.0 demo passed:

- an automated run in the Chromium, Firefox and WebKit builds bundled with [Playwright](https://playwright.dev/), which are close to but not the same as Chrome, Firefox and Safari
- the maintainer's manual smoke test and NVDA test, described [above](#accessibility-testing), whose browsers weren't recorded

Stepr is compiled to ES2022 and relies on CSS `clip-path: path()`, CSS `min()` and the `signal` option of `addEventListener`, so browsers that lack them aren't supported.

## Known limitations

Tours:

- Button labels and the counter are English only.
- All steps use the default spotlight and tooltip options; per-step placement isn't available.
- A step whose target isn't rendered when it is reached is skipped. Stepr doesn't wait for targets, follow route changes or remember progress.
- A target hidden with `visibility: hidden` or `opacity: 0` still has a layout box, so its step is shown.
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

Try the [live demo](https://ahlgren1234.github.io/stepr/). To run it locally from a clone of this repository:

```bash
pnpm install
pnpm build
pnpm dlx serve .
```

Open `/demo/` for the documentation and demo site, or `/demo/smoke.html` for the edge-case page used in [release testing](RELEASING.md#manual-smoke-test).

## Development

Requires Node.js 24 and pnpm (version pinned in `package.json`).

| Command             | Description                                     |
| ------------------- | ----------------------------------------------- |
| `pnpm install`      | Install dependencies                            |
| `pnpm build`        | Compile to `dist/` with declarations            |
| `pnpm build:pages`  | Build the GitHub Pages site in `_site/`         |
| `pnpm test`         | Run unit tests                                  |
| `pnpm test:package` | Import the built package (after `build`)        |
| `pnpm size`         | Measure package and bundle size (after `build`) |
| `pnpm lint`         | Run ESLint and check Prettier formatting        |
| `pnpm format`       | Apply Prettier formatting                       |
| `pnpm typecheck`    | Type-check without emitting                     |

See [RELEASING.md](RELEASING.md) for the release process.

## License

[MIT](LICENSE)
