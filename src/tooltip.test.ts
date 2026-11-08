// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createSpotlight } from './spotlight.js';
import { createTooltip } from './tooltip.js';
import type { TooltipPlacement } from './tooltip.js';

const TOOLTIP_WIDTH = 200;
const TOOLTIP_HEIGHT = 100;
const CONTENT = { title: 'Title', description: 'Description' };

const tooltips = () =>
  document.querySelectorAll<HTMLElement>('[data-guidely-tooltip]');

function setViewport(width: number, height: number): void {
  const root = document.documentElement;
  Object.defineProperty(root, 'clientWidth', {
    configurable: true,
    value: width,
  });
  Object.defineProperty(root, 'clientHeight', {
    configurable: true,
    value: height,
  });
}

/** Adds an element with a stubbed layout box; happy-dom performs no layout. */
function addTarget(left: number, top: number, width = 100, height = 50) {
  const element = document.createElement('div');
  element.id = 'target';
  const rect = vi.fn(() => new DOMRect(left, top, width, height));
  element.getBoundingClientRect = rect;
  document.body.append(element);
  return { element, rect };
}

function position() {
  const style = tooltips()[0]?.style;
  return {
    left: parseFloat(style?.left ?? ''),
    top: parseFloat(style?.top ?? ''),
  };
}

beforeEach(() => {
  setViewport(1000, 800);
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, TOOLTIP_WIDTH, TOOLTIP_HEIGHT),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('content', () => {
  test('renders title and description for selector and element targets', () => {
    const { element } = addTarget(400, 300);
    const tooltip = createTooltip();

    expect(tooltip.show('#target', CONTENT)).toBe(true);
    expect(tooltips()[0]?.textContent).toBe('TitleDescription');
    expect(tooltip.show(element, { title: 'Only title' })).toBe(true);
    expect(tooltips()[0]?.textContent).toBe('Only title');
    expect(tooltips()).toHaveLength(1);
  });

  test('renders markup as inert text', () => {
    const { element } = addTarget(400, 300);
    const markup = '<img src=x onerror="alert(1)"><b>bold</b>';

    createTooltip().show(element, { title: markup, description: markup });

    const node = tooltips()[0];
    expect(node?.querySelector('img, b')).toBeNull();
    expect(node?.textContent).toBe(markup + markup);
  });

  test('exposes CSS custom properties for theming', () => {
    const { element } = addTarget(400, 300);
    createTooltip().show(element, CONTENT);

    expect(tooltips()[0]?.style.background).toContain(
      'var(--guidely-tooltip-background',
    );
    expect(tooltips()[0]?.style.color).toContain('var(--guidely-tooltip-color');
  });
});

describe('placement', () => {
  test.each<[TooltipPlacement, number, number]>([
    ['bottom', 350, 366],
    ['top', 350, 184],
    ['right', 516, 275],
    ['left', 184, 275],
  ])('honors %s when it fits', (placement, left, top) => {
    const { element } = addTarget(400, 300);
    createTooltip({ placement }).show(element, CONTENT);
    expect(position()).toEqual({ left, top });
  });

  test.each<
    [string, TooltipPlacement, number[], { left: number; top: number }]
  >([
    ['bottom to top', 'bottom', [400, 760, 100, 30], { left: 350, top: 644 }],
    ['top to bottom', 'top', [400, 10, 100, 30], { left: 350, top: 56 }],
    ['right to left', 'right', [900, 300, 80, 50], { left: 684, top: 275 }],
    ['left to right', 'left', [10, 300, 80, 50], { left: 106, top: 275 }],
  ])('flips %s', (_name, placement, [x, y, w, h], expected) => {
    const { element } = addTarget(x!, y!, w, h);
    createTooltip({ placement }).show(element, CONTENT);
    expect(position()).toEqual(expected);
  });

  test('uses a perpendicular side when both preferred sides overflow', () => {
    const { element } = addTarget(400, 0, 100, 800);
    createTooltip().show(element, CONTENT);
    expect(position()).toEqual({ left: 184, top: 350 });
  });

  test.each([
    ['left', [0, 300, 40, 30], 8],
    ['right', [960, 300, 40, 30], 792],
  ])('shifts away from the %s edge', (_name, [x, y, w, h], left) => {
    const { element } = addTarget(x!, y!, w, h);
    createTooltip().show(element, CONTENT);
    expect(position()).toEqual({ left, top: 346 });
  });

  test('stays inside the viewport when no side fits', () => {
    setViewport(300, 200);
    const { element } = addTarget(100, 75);
    createTooltip().show(element, CONTENT);

    const { left, top } = position();
    expect(left).toBeGreaterThanOrEqual(8);
    expect(left + TOOLTIP_WIDTH).toBeLessThanOrEqual(292);
    expect(top).toBeGreaterThanOrEqual(8);
    expect(top + TOOLTIP_HEIGHT).toBeLessThanOrEqual(192);
  });

  test('applies offset and zIndex options', () => {
    const { element } = addTarget(400, 300);
    createTooltip({ offset: 4, zIndex: 42 }).show(element, CONTENT);

    expect(position().top).toBe(354);
    expect(tooltips()[0]?.style.zIndex).toBe('42');
  });
});

describe('updates', () => {
  function showMovingTarget() {
    const { element, rect } = addTarget(400, 300);
    const tooltip = createTooltip();
    tooltip.show(element, CONTENT);
    rect.mockReturnValue(new DOMRect(400, 100, 100, 50));
    return { element, rect, tooltip };
  }

  test('follows the target on window scroll', () => {
    showMovingTarget();
    window.dispatchEvent(new Event('scroll'));
    expect(position().top).toBe(166);
  });

  test('follows the target when a nested container scrolls', () => {
    const container = document.createElement('div');
    document.body.append(container);
    showMovingTarget();
    container.dispatchEvent(new Event('scroll'));
    expect(position().top).toBe(166);
  });

  test('flips when a resize removes the room', () => {
    const { element } = addTarget(400, 300);
    createTooltip().show(element, CONTENT);

    setViewport(1000, 400);
    window.dispatchEvent(new Event('resize'));

    expect(position().top).toBe(184);
  });

  test('update() repositions on demand', () => {
    const { tooltip } = showMovingTarget();
    tooltip.update();
    expect(position().top).toBe(166);
  });

  test('removes the tooltip if the target leaves the DOM', () => {
    const { element } = showMovingTarget();
    element.remove();
    window.dispatchEvent(new Event('scroll'));
    expect(tooltips()).toHaveLength(0);
  });
});

describe('missing targets and empty content', () => {
  test.each([
    ['unmatched selector', () => '#nope'],
    ['invalid selector', () => '##('],
    ['detached element', () => document.createElement('div')],
    ['element without a layout box', () => addTarget(0, 0, 0, 0).element],
  ])('%s returns false without a tooltip', (_name, getTarget) => {
    expect(createTooltip().show(getTarget(), CONTENT)).toBe(false);
    expect(tooltips()).toHaveLength(0);
  });

  test('empty content returns false and removes the current tooltip', () => {
    const { element } = addTarget(400, 300);
    const tooltip = createTooltip();
    tooltip.show(element, CONTENT);

    expect(tooltip.show(element, {})).toBe(false);
    expect(tooltips()).toHaveLength(0);
  });
});

describe('destroy', () => {
  test('removes the tooltip and stops listening', () => {
    const { element, rect } = addTarget(400, 300);
    const tooltip = createTooltip();
    tooltip.show(element, CONTENT);
    tooltip.destroy();
    rect.mockClear();

    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('resize'));

    expect(tooltips()).toHaveLength(0);
    expect(rect).not.toHaveBeenCalled();
  });

  test('is safe to call repeatedly and without show', () => {
    const tooltip = createTooltip();
    expect(() => {
      tooltip.destroy();
      tooltip.destroy();
      tooltip.update();
    }).not.toThrow();
  });

  test('repeated show/destroy does not accumulate tooltips or listeners', () => {
    const { element, rect } = addTarget(400, 300);
    const tooltip = createTooltip();
    for (let i = 0; i < 3; i++) {
      tooltip.show(element, CONTENT);
      tooltip.destroy();
    }

    tooltip.show(element, CONTENT);
    rect.mockClear();
    window.dispatchEvent(new Event('scroll'));

    expect(tooltips()).toHaveLength(1);
    expect(rect).toHaveBeenCalledTimes(1);
  });
});

describe('with a spotlight', () => {
  test('sits above the overlay and is destroyed independently', () => {
    const { element } = addTarget(400, 300);
    const spotlight = createSpotlight();
    const tooltip = createTooltip();
    spotlight.show(element);
    tooltip.show(element, CONTENT);

    const overlay = document.querySelector<HTMLElement>(
      '[data-guidely-spotlight]',
    );
    expect(Number(tooltips()[0]?.style.zIndex)).toBeGreaterThan(
      Number(overlay?.style.zIndex),
    );

    tooltip.destroy();
    expect(overlay?.isConnected).toBe(true);

    tooltip.show(element, CONTENT);
    spotlight.destroy();
    expect(tooltips()).toHaveLength(1);
  });
});
