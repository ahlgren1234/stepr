export type SpotlightTarget = string | HTMLElement;

export interface SpotlightOptions {
  /** Space in pixels between the target and the cutout edge. Default: 8. */
  padding?: number;
  /** Corner radius of the cutout in pixels. Default: 4. */
  borderRadius?: number;
  /** Any CSS color. Default: `rgba(0, 0, 0, 0.5)`. */
  overlayColor?: string;
  /** Default: 9999. */
  zIndex?: number;
}

export interface Spotlight {
  /**
   * Highlights the target, replacing any current highlight. Returns `false` and
   * removes the overlay if the target is missing, detached, or has no size.
   */
  show(target: SpotlightTarget): boolean;
  /**
   * Repositions the cutout for layout changes not caused by scroll or resize.
   * Removes the overlay if the target has been detached or hidden.
   */
  update(): void;
  /** Removes the overlay and all listeners. `show()` may be called again. */
  destroy(): void;
}

export function createSpotlight(options: SpotlightOptions = {}): Spotlight {
  const {
    padding = 8,
    borderRadius = 4,
    overlayColor = 'rgba(0, 0, 0, 0.5)',
    zIndex = 9999,
  } = options;

  let target: Element | undefined;
  let overlay: HTMLElement | undefined;
  let listeners: AbortController | undefined;

  function paint(rect: DOMRect): void {
    if (overlay) {
      overlay.style.clipPath = cutoutPath(rect, padding, borderRadius);
    }
  }

  function mount(): void {
    overlay = document.createElement('div');
    overlay.setAttribute('data-guidely-spotlight', '');
    overlay.setAttribute('aria-hidden', 'true');
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      background: overlayColor,
      pointerEvents: 'none',
      zIndex: String(zIndex),
    });
    document.body.append(overlay);

    listeners = new AbortController();
    const { signal } = listeners;
    // Scroll events don't bubble, so capture also catches nested scrollers.
    window.addEventListener('scroll', update, {
      capture: true,
      passive: true,
      signal,
    });
    window.addEventListener('resize', update, { signal });
  }

  function update(): void {
    if (!target) return;
    const rect = measure(target);
    if (rect) paint(rect);
    else destroy();
  }

  function show(next: SpotlightTarget): boolean {
    const element = resolve(next);
    const rect = element && measure(element);
    if (!element || !rect) {
      destroy();
      return false;
    }
    target = element;
    if (!overlay) mount();
    paint(rect);
    return true;
  }

  function destroy(): void {
    listeners?.abort();
    overlay?.remove();
    listeners = undefined;
    overlay = undefined;
    target = undefined;
  }

  return { show, update, destroy };
}

function resolve(target: SpotlightTarget): Element | null {
  if (typeof target !== 'string') return target;
  try {
    return document.querySelector(target);
  } catch {
    // An invalid selector is treated like one that matches nothing.
    return null;
  }
}

function measure(element: Element): DOMRect | undefined {
  if (!element.isConnected) return undefined;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 || rect.height > 0 ? rect : undefined;
}

/** A viewport-sized rectangle with a rounded hole; even-odd fill cuts it out. */
function cutoutPath(rect: DOMRect, padding: number, radius: number): string {
  const x = rect.left - padding;
  const y = rect.top - padding;
  const width = rect.width + padding * 2;
  const height = rect.height + padding * 2;
  const r = Math.min(radius, width / 2, height / 2);
  const corner = `A${r} ${r} 0 0 1`;

  const outer = `M0 0H${window.innerWidth}V${window.innerHeight}H0Z`;
  const hole =
    `M${x + r} ${y}H${x + width - r}${corner} ${x + width} ${y + r}` +
    `V${y + height - r}${corner} ${x + width - r} ${y + height}` +
    `H${x + r}${corner} ${x} ${y + height - r}` +
    `V${y + r}${corner} ${x + r} ${y}Z`;
  return `path(evenodd, "${outer}${hole}")`;
}
