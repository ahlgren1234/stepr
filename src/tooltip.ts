import { measure, onViewportChange, resolve } from './dom.js';
import type { SpotlightTarget } from './spotlight.js';

export type TooltipPlacement = 'top' | 'right' | 'bottom' | 'left';

export interface TooltipContent {
  title?: string;
  description?: string;
  /** Element placed below the text as given, for example action buttons. */
  footer?: HTMLElement;
}

export interface TooltipOptions {
  /** Preferred side of the target; flips if it doesn't fit. Default: `bottom`. */
  placement?: TooltipPlacement;
  /** Space in pixels between the target and the tooltip. Default: 16. */
  offset?: number;
  /** Default: 10000, above the spotlight overlay. */
  zIndex?: number;
}

export interface Tooltip {
  /**
   * Shows the content next to the target, with title and description as plain
   * text, replacing any current tooltip. Returns `false` and removes the tooltip if the target is missing,
   * detached, or has no size, or if the content is empty.
   */
  show(target: SpotlightTarget, content: TooltipContent): boolean;
  /**
   * Repositions for layout changes not caused by scroll or resize. Removes the
   * tooltip if the target has been detached or hidden.
   */
  update(): void;
  /** Removes the tooltip and all listeners. `show()` may be called again. */
  destroy(): void;
}

/** Minimum distance in pixels between the tooltip and the viewport edge. */
const VIEWPORT_MARGIN = 8;

const FALLBACKS: Record<TooltipPlacement, TooltipPlacement[]> = {
  top: ['bottom', 'left', 'right'],
  bottom: ['top', 'left', 'right'],
  left: ['right', 'top', 'bottom'],
  right: ['left', 'top', 'bottom'],
};

export function createTooltip(options: TooltipOptions = {}): Tooltip {
  const { placement = 'bottom', offset = 16, zIndex = 10000 } = options;

  let target: Element | undefined;
  let tooltip: HTMLElement | undefined;
  let listeners: AbortController | undefined;

  function paint(anchor: DOMRect): void {
    if (!tooltip) return;
    const { left, top } = computePosition(
      anchor,
      tooltip.getBoundingClientRect(),
      placement,
      offset,
    );
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function mount(): void {
    tooltip = document.createElement('div');
    tooltip.setAttribute('data-guidely-tooltip', '');
    tooltip.setAttribute('role', 'tooltip');
    Object.assign(tooltip.style, {
      position: 'fixed',
      display: 'grid',
      gap: '4px',
      boxSizing: 'border-box',
      // A fixed width keeps wrapping independent of the current position.
      width: 'max-content',
      maxWidth: `min(var(--guidely-tooltip-max-width, 20rem), calc(100vw - ${VIEWPORT_MARGIN * 2}px))`,
      maxHeight: `calc(100vh - ${VIEWPORT_MARGIN * 2}px)`,
      overflow: 'auto',
      overflowWrap: 'anywhere',
      background: 'var(--guidely-tooltip-background, #fff)',
      color: 'var(--guidely-tooltip-color, #111)',
      borderRadius: 'var(--guidely-tooltip-border-radius, 8px)',
      padding: 'var(--guidely-tooltip-padding, 12px)',
      boxShadow:
        'var(--guidely-tooltip-shadow, 0 4px 16px rgba(0, 0, 0, 0.25))',
      zIndex: String(zIndex),
    });
    document.body.append(tooltip);
    listeners = onViewportChange(update);
  }

  function render({ title, description, footer }: TooltipContent): void {
    const parts: HTMLElement[] = [];
    if (title) {
      const element = document.createElement('div');
      element.style.fontWeight = '600';
      element.textContent = title;
      parts.push(element);
    }
    if (description) {
      const element = document.createElement('div');
      element.textContent = description;
      parts.push(element);
    }
    if (footer) parts.push(footer);
    tooltip?.replaceChildren(...parts);
  }

  function update(): void {
    if (!target) return;
    const rect = measure(target);
    if (rect) paint(rect);
    else destroy();
  }

  function show(next: SpotlightTarget, content: TooltipContent): boolean {
    const element = resolve(next);
    const rect = element && measure(element);
    const isEmpty = !content.title && !content.description && !content.footer;
    if (!element || !rect || isEmpty) {
      destroy();
      return false;
    }
    target = element;
    if (!tooltip) mount();
    render(content);
    paint(rect);
    return true;
  }

  function destroy(): void {
    listeners?.abort();
    tooltip?.remove();
    listeners = undefined;
    tooltip = undefined;
    target = undefined;
  }

  return { show, update, destroy };
}

function computePosition(
  anchor: DOMRect,
  { width, height }: DOMRect,
  preferred: TooltipPlacement,
  offset: number,
): { left: number; top: number } {
  const { clientWidth, clientHeight } = document.documentElement;

  // How far the tooltip would extend past the viewport margin on each side.
  const overflow: Record<TooltipPlacement, number> = {
    top: VIEWPORT_MARGIN - (anchor.top - offset - height),
    bottom: anchor.bottom + offset + height - (clientHeight - VIEWPORT_MARGIN),
    left: VIEWPORT_MARGIN - (anchor.left - offset - width),
    right: anchor.right + offset + width - (clientWidth - VIEWPORT_MARGIN),
  };
  const side = [preferred, ...FALLBACKS[preferred]].reduce((best, next) =>
    Math.max(overflow[next], 0) < Math.max(overflow[best], 0) ? next : best,
  );

  const centeredLeft = anchor.left + (anchor.width - width) / 2;
  const centeredTop = anchor.top + (anchor.height - height) / 2;
  const position = {
    top: { left: centeredLeft, top: anchor.top - offset - height },
    bottom: { left: centeredLeft, top: anchor.bottom + offset },
    left: { left: anchor.left - offset - width, top: centeredTop },
    right: { left: anchor.right + offset, top: centeredTop },
  }[side];

  return {
    left: clamp(position.left, clientWidth - width - VIEWPORT_MARGIN),
    top: clamp(position.top, clientHeight - height - VIEWPORT_MARGIN),
  };
}

/** Keeps a coordinate within the viewport; the start edge wins if both can't. */
function clamp(value: number, max: number): number {
  return Math.max(VIEWPORT_MARGIN, Math.min(value, max));
}
