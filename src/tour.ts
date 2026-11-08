import { measure, onViewportChange, resolve } from './dom.js';
import { createSpotlight } from './spotlight.js';
import type { SpotlightTarget } from './spotlight.js';
import { createTooltip } from './tooltip.js';

export interface TourStep {
  target: SpotlightTarget;
  title?: string;
  description?: string;
}

export interface TourOptions {
  steps: readonly TourStep[];
  /** Called when the tour moves past its last step. */
  onComplete?: () => void;
  /**
   * Called when the tour ends early: through the Close button or Escape, or
   * because the current target disappeared with no later step to move to.
   */
  onExit?: () => void;
}

export interface Tour {
  /**
   * Shows the first available step and moves focus to it; does nothing if
   * already running. Returns `false` if no step has an available target,
   * otherwise `true`.
   */
  start(): boolean;
  /** Moves to the next available step, or completes the tour after the last. */
  next(): void;
  /** Moves to the previous available step; does nothing on the first. */
  previous(): void;
  /**
   * Removes the tour's DOM nodes and listeners without calling a callback, and
   * returns focus to where it was before `start()` unless it has since moved
   * to another element. `start()` may be called again.
   */
  destroy(): void;
}

interface Controls {
  footer: HTMLElement;
  counter: HTMLElement;
  back: HTMLButtonElement;
  next: HTMLButtonElement;
  /** Announces step changes, since focus stays on the activated button. */
  status: HTMLElement;
}

export function createTour(options: TourOptions): Tour {
  const { steps, onComplete, onExit } = options;
  const spotlight = createSpotlight();
  const tooltip = createTooltip({ role: 'dialog' });

  let current: { index: number; element: Element } | undefined;
  let controls: Controls | undefined;
  let listeners: AbortController | undefined;
  let origin: HTMLElement | undefined;

  function findElement(step: TourStep | undefined): HTMLElement | undefined {
    const element = step && resolve(step.target);
    // A selector can match any Element; the components only use Element APIs.
    return element && measure(element) ? (element as HTMLElement) : undefined;
  }

  /** Indexes of the steps whose targets can currently be shown. */
  function availableIndexes(): number[] {
    return steps.flatMap((step, index) => (findElement(step) ? [index] : []));
  }

  function createControls(): Controls {
    const footer = document.createElement('div');
    Object.assign(footer.style, {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: '8px',
      marginTop: '8px',
    });

    const counter = document.createElement('span');
    counter.style.marginRight = 'auto';

    const back = createButton('Back', previous);
    const next = createButton('Next', () => advance(onComplete));
    const close = createButton('Close', () => end(onExit));
    footer.append(counter, back, next, close);

    const status = document.createElement('div');
    status.setAttribute('data-guidely-status', '');
    status.setAttribute('role', 'status');
    Object.assign(status.style, {
      position: 'fixed',
      width: '1px',
      height: '1px',
      overflow: 'hidden',
      clipPath: 'inset(50%)',
      whiteSpace: 'nowrap',
    });
    document.body.append(status);

    return { footer, counter, back, next, status };
  }

  /** Returns `false` if the step's target could not be displayed. */
  function show(index: number, available: number[]): boolean {
    const step = steps[index];
    const element = findElement(step);
    if (!step || !element || !controls) return false;
    const { footer, counter, back, next, status } = controls;

    const position = available.indexOf(index);
    const count = `Step ${position + 1} of ${available.length}`;
    const label = step.title ? `${step.title}: ${count}` : count;
    counter.textContent = count;
    back.disabled = position === 0;
    next.textContent = position === available.length - 1 ? 'Done' : 'Next';

    // Re-rendering the tooltip reinserts the footer, which drops focus. Focus
    // is also lost if the tooltip removed itself because its target went away.
    const { activeElement } = document;
    const focused = footer.contains(activeElement)
      ? (activeElement as HTMLButtonElement)
      : undefined;
    const keepFocus = focused ?? isFocusLost();

    element.scrollIntoView({
      behavior: prefersReducedMotion() ? 'instant' : 'auto',
      block: 'center',
      inline: 'nearest',
    });
    const shown =
      spotlight.show(element) &&
      tooltip.show(element, {
        title: step.title,
        description: step.description,
        footer,
        label,
      });
    if (!shown) return false;

    // The first step is announced through the dialog when focus enters it.
    if (current) {
      status.textContent = [label, step.description].filter(Boolean).join('. ');
    }
    current = { index, element };
    if (keepFocus) (focused && !focused.disabled ? focused : next).focus();
    return true;
  }

  function start(): boolean {
    if (current) return true;
    const available = availableIndexes();
    const first = available[0];
    if (first === undefined) return false;

    origin = isFocusLost()
      ? undefined
      : (document.activeElement as HTMLElement);
    const created = createControls();
    controls = created;
    if (!show(first, available)) {
      destroy();
      return false;
    }
    created.next.focus();
    listeners = onViewportChange(() => {
      if (current && !measure(current.element)) advance(onExit);
    });
    document.addEventListener('keydown', onKeydown, {
      signal: listeners.signal,
    });
    return true;
  }

  function onKeydown(event: KeyboardEvent): void {
    // Handlers in the page run first, and can claim the key for themselves.
    if (event.defaultPrevented || event.isComposing) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      end(onExit);
    }
  }

  function advance(onEnd: (() => void) | undefined): void {
    if (!current) return;
    const { index } = current;
    const available = availableIndexes();
    const later = available.find((candidate) => candidate > index);
    if (later === undefined) end(onEnd);
    else if (!show(later, available)) end(onExit);
  }

  function previous(): void {
    if (!current) return;
    const { index } = current;
    const available = availableIndexes();
    const earlier = available.filter((candidate) => candidate < index).at(-1);
    if (earlier !== undefined && !show(earlier, available)) end(onExit);
  }

  function end(callback: (() => void) | undefined): void {
    destroy();
    callback?.();
  }

  function destroy(): void {
    listeners?.abort();
    spotlight.destroy();
    tooltip.destroy();
    controls?.status.remove();
    if (origin && isFocusLost()) restoreFocus(origin);
    listeners = undefined;
    controls = undefined;
    current = undefined;
    origin = undefined;
  }

  return { start, next: () => advance(onComplete), previous, destroy };
}

/** Whether focus is on no particular element, as after removing its element. */
function isFocusLost(): boolean {
  const { activeElement, body } = document;
  return !activeElement || activeElement === body;
}

function restoreFocus(element: HTMLElement): void {
  if (!prefersReducedMotion()) {
    element.focus();
    return;
  }
  // Focusing scrolls with the page's `scroll-behavior`, which may be smooth.
  element.focus({ preventScroll: true });
  if (document.activeElement === element) {
    element.scrollIntoView({ behavior: 'instant', block: 'nearest' });
  }
}

function prefersReducedMotion(): boolean {
  // Optional because some non-browser test environments lack `matchMedia`.
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function createButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}
