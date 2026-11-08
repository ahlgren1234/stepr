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
   * Called when the tour ends early: through the Close button, or because the
   * current target disappeared with no later step to move to.
   */
  onExit?: () => void;
}

export interface Tour {
  /**
   * Shows the first available step; does nothing if already running. Returns
   * `false` if no step has an available target, otherwise `true`.
   */
  start(): boolean;
  /** Moves to the next available step, or completes the tour after the last. */
  next(): void;
  /** Moves to the previous available step; does nothing on the first. */
  previous(): void;
  /**
   * Removes the tour's DOM nodes and listeners without calling a callback.
   * `start()` may be called again.
   */
  destroy(): void;
}

interface Controls {
  footer: HTMLElement;
  counter: HTMLElement;
  back: HTMLButtonElement;
  next: HTMLButtonElement;
}

export function createTour(options: TourOptions): Tour {
  const { steps, onComplete, onExit } = options;
  const spotlight = createSpotlight();
  const tooltip = createTooltip();

  let current: { index: number; element: Element } | undefined;
  let controls: Controls | undefined;
  let listeners: AbortController | undefined;

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

    return { footer, counter, back, next };
  }

  /** Returns `false` if the step's target could not be displayed. */
  function show(index: number, available: number[]): boolean {
    const step = steps[index];
    const element = findElement(step);
    if (!step || !element || !controls) return false;
    const { footer, counter, back, next } = controls;

    const position = available.indexOf(index);
    counter.textContent = `Step ${position + 1} of ${available.length}`;
    back.disabled = position === 0;
    next.textContent = position === available.length - 1 ? 'Done' : 'Next';

    // Re-rendering the tooltip reinserts the footer, which drops focus.
    const { activeElement } = document;
    const focused = footer.contains(activeElement)
      ? (activeElement as HTMLButtonElement)
      : undefined;

    element.scrollIntoView({ block: 'center', inline: 'nearest' });
    const shown =
      spotlight.show(element) &&
      tooltip.show(element, {
        title: step.title,
        description: step.description,
        footer,
      });
    if (!shown) return false;

    current = { index, element };
    if (focused) (focused.disabled ? next : focused).focus();
    return true;
  }

  function start(): boolean {
    if (current) return true;
    const available = availableIndexes();
    const first = available[0];
    if (first === undefined) return false;

    controls = createControls();
    if (!show(first, available)) {
      destroy();
      return false;
    }
    listeners = onViewportChange(() => {
      if (current && !measure(current.element)) advance(onExit);
    });
    return true;
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
    listeners = undefined;
    controls = undefined;
    current = undefined;
  }

  return { start, next: () => advance(onComplete), previous, destroy };
}

function createButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}
