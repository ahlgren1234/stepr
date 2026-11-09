// @vitest-environment happy-dom
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createSpotlight } from './spotlight.js';

const overlays = () =>
  document.querySelectorAll<HTMLElement>('[data-stepr-spotlight]');

/** Adds an element with a stubbed layout box; happy-dom performs no layout. */
function addTarget(left: number, top: number, width = 100, height = 50) {
  const element = document.createElement('div');
  element.id = 'target';
  const rect = vi.fn(() => new DOMRect(left, top, width, height));
  element.getBoundingClientRect = rect;
  document.body.append(element);
  return { element, rect };
}

/** Returns the start of the cutout, i.e. the second subpath of the clip-path. */
function cutoutStart(): string | undefined {
  return overlays()[0]?.style.clipPath.match(/ZM(-?[\d.]+ -?[\d.]+)/)?.[1];
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('show', () => {
  test('highlights an element target', () => {
    const { element } = addTarget(10, 20);
    const spotlight = createSpotlight({ padding: 0, borderRadius: 0 });

    expect(spotlight.show(element)).toBe(true);
    expect(overlays()).toHaveLength(1);
    expect(cutoutStart()).toBe('10 20');
  });

  test('highlights a selector target', () => {
    addTarget(10, 20);
    const spotlight = createSpotlight({ padding: 0, borderRadius: 0 });

    expect(spotlight.show('#target')).toBe(true);
    expect(cutoutStart()).toBe('10 20');
  });

  test('applies options', () => {
    const { element } = addTarget(100, 100);
    const spotlight = createSpotlight({
      padding: 10,
      borderRadius: 5,
      overlayColor: 'red',
      zIndex: 42,
    });

    spotlight.show(element);

    const overlay = overlays()[0];
    expect(cutoutStart()).toBe('95 90');
    expect(overlay?.style.background).toBe('red');
    expect(overlay?.style.zIndex).toBe('42');
  });

  test('moves to a new target using the same overlay', () => {
    const first = addTarget(10, 20).element;
    const second = addTarget(30, 40).element;
    const spotlight = createSpotlight({ padding: 0, borderRadius: 0 });

    spotlight.show(first);
    const overlay = overlays()[0];
    spotlight.show(second);

    expect(overlays()[0]).toBe(overlay);
    expect(overlays()).toHaveLength(1);
    expect(cutoutStart()).toBe('30 40');
  });
});

describe('repositioning', () => {
  function showMovingTarget() {
    const { element, rect } = addTarget(10, 20);
    createSpotlight({ padding: 0, borderRadius: 0 }).show(element);
    rect.mockReturnValue(new DOMRect(10, -80, 100, 50));
    return element;
  }

  test('follows the target on window scroll', () => {
    showMovingTarget();
    window.dispatchEvent(new Event('scroll'));
    expect(cutoutStart()).toBe('10 -80');
  });

  test('follows the target when a nested container scrolls', () => {
    const container = document.createElement('div');
    document.body.append(container);
    showMovingTarget();
    container.dispatchEvent(new Event('scroll'));
    expect(cutoutStart()).toBe('10 -80');
  });

  test('follows the target on resize', () => {
    showMovingTarget();
    window.dispatchEvent(new Event('resize'));
    expect(cutoutStart()).toBe('10 -80');
  });

  test('update() repositions on demand', () => {
    const { element, rect } = addTarget(10, 20);
    const spotlight = createSpotlight({ padding: 0, borderRadius: 0 });
    spotlight.show(element);
    rect.mockReturnValue(new DOMRect(50, 60, 100, 50));

    spotlight.update();

    expect(cutoutStart()).toBe('50 60');
  });

  test('removes the overlay if the target leaves the DOM', () => {
    const element = showMovingTarget();
    element.remove();
    window.dispatchEvent(new Event('scroll'));
    expect(overlays()).toHaveLength(0);
  });
});

describe('missing targets', () => {
  test.each([
    ['unmatched selector', () => '#nope'],
    ['invalid selector', () => '##('],
    ['detached element', () => document.createElement('div')],
    ['element without a layout box', () => addTarget(0, 0, 0, 0).element],
  ])('%s returns false without an overlay', (_name, getTarget) => {
    const spotlight = createSpotlight();
    expect(spotlight.show(getTarget())).toBe(false);
    expect(overlays()).toHaveLength(0);
  });

  test('removes the current highlight', () => {
    const spotlight = createSpotlight();
    spotlight.show(addTarget(10, 20).element);

    expect(spotlight.show('#nope')).toBe(false);
    expect(overlays()).toHaveLength(0);
  });
});

describe('destroy', () => {
  test('removes the overlay and stops listening', () => {
    const { element, rect } = addTarget(10, 20);
    const spotlight = createSpotlight();
    spotlight.show(element);
    spotlight.destroy();
    rect.mockClear();

    window.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('resize'));

    expect(overlays()).toHaveLength(0);
    expect(rect).not.toHaveBeenCalled();
  });

  test('is safe to call repeatedly and without show', () => {
    const spotlight = createSpotlight();
    expect(() => {
      spotlight.destroy();
      spotlight.destroy();
      spotlight.update();
    }).not.toThrow();
  });

  test('repeated show/destroy does not accumulate overlays or listeners', () => {
    const { element, rect } = addTarget(10, 20);
    const spotlight = createSpotlight();
    for (let i = 0; i < 3; i++) {
      spotlight.show(element);
      spotlight.destroy();
    }
    expect(overlays()).toHaveLength(0);

    spotlight.show(element);
    rect.mockClear();
    window.dispatchEvent(new Event('scroll'));

    expect(overlays()).toHaveLength(1);
    expect(rect).toHaveBeenCalledTimes(1);
  });
});
