// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createTour as createRealTour } from './tour.js';
import type { Tour, TourOptions } from './tour.js';

// Tours listen on the shared window, so each test must destroy its own.
const created: Tour[] = [];
function createTour(options: TourOptions): Tour {
  const tour = createRealTour(options);
  created.push(tour);
  return tour;
}

const tooltipNode = () =>
  document.querySelector<HTMLElement>('[data-guidely-tooltip]');
const overlayNode = () => document.querySelector('[data-guidely-spotlight]');
const button = (label: string) =>
  [...(tooltipNode()?.querySelectorAll('button') ?? [])].find(
    (element) => element.textContent === label,
  );
const text = () => tooltipNode()?.textContent ?? '';

function addTarget(id: string) {
  const element = document.createElement('div');
  element.id = id;
  const rect = vi.fn(() => new DOMRect(400, 300, 100, 50));
  element.getBoundingClientRect = rect;
  element.scrollIntoView = vi.fn();
  document.body.append(element);
  return { element, rect };
}

function threeStepTour(overrides: Partial<TourOptions> = {}) {
  const onComplete = vi.fn();
  const onExit = vi.fn();
  const tour = createTour({
    steps: [
      { target: '#a', title: 'Title A', description: 'Description A' },
      { target: '#b', title: 'Title B' },
      { target: '#c', description: 'Description C' },
    ],
    onComplete,
    onExit,
    ...overrides,
  });
  return { tour, onComplete, onExit };
}

function expectNoTourNodes() {
  expect(tooltipNode()).toBeNull();
  expect(overlayNode()).toBeNull();
}

beforeEach(() => {
  Object.defineProperty(document.documentElement, 'clientWidth', {
    configurable: true,
    value: 1000,
  });
  Object.defineProperty(document.documentElement, 'clientHeight', {
    configurable: true,
    value: 800,
  });
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 200, 100),
  );
  for (const id of ['a', 'b', 'c']) addTarget(id);
});

afterEach(() => {
  for (const tour of created.splice(0)) tour.destroy();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('steps and controls', () => {
  test('start() shows the first step with its content and counter', () => {
    const { tour } = threeStepTour();

    expect(tour.start()).toBe(true);

    expect(overlayNode()).not.toBeNull();
    expect(text()).toContain('Title A');
    expect(text()).toContain('Description A');
    expect(text()).toContain('Step 1 of 3');
  });

  test('accepts element targets', () => {
    const { element } = addTarget('element');
    const tour = createTour({ steps: [{ target: element, title: 'Element' }] });

    expect(tour.start()).toBe(true);
    expect(text()).toContain('Element');
  });

  test('uses semantic, non-submitting buttons', () => {
    threeStepTour().tour.start();

    for (const label of ['Back', 'Next', 'Close']) {
      expect(button(label)?.type).toBe('button');
    }
  });

  test('buttons and methods navigate between steps', () => {
    const { tour } = threeStepTour();
    tour.start();

    button('Next')?.click();
    expect(text()).toContain('Title B');
    expect(text()).toContain('Step 2 of 3');

    tour.next();
    expect(text()).toContain('Description C');

    button('Back')?.click();
    expect(text()).toContain('Title B');

    tour.previous();
    expect(text()).toContain('Title A');
  });

  test('renders step content as inert text', () => {
    const markup = '<img src=x onerror="alert(1)">';
    createTour({
      steps: [{ target: '#a', title: markup, description: markup }],
    }).start();

    expect(tooltipNode()?.querySelector('img')).toBeNull();
    expect(text()).toContain(markup);
  });

  test('scrolls the target into view', () => {
    threeStepTour().tour.start();
    expect(document.querySelector('#a')?.scrollIntoView).toHaveBeenCalledOnce();
  });
});

describe('boundaries', () => {
  test('previous() on the first step does nothing and Back is disabled', () => {
    const { tour, onExit } = threeStepTour();
    tour.start();

    tour.previous();

    expect(button('Back')?.disabled).toBe(true);
    expect(text()).toContain('Title A');
    expect(onExit).not.toHaveBeenCalled();
  });

  test('next() on the last step completes the tour once', () => {
    const { tour, onComplete, onExit } = threeStepTour();
    tour.start();
    tour.next();
    tour.next();
    expect(button('Done')).toBeDefined();

    button('Done')?.click();
    tour.next();

    expect(onComplete).toHaveBeenCalledOnce();
    expect(onExit).not.toHaveBeenCalled();
    expectNoTourNodes();
  });

  test('Close exits the tour once', () => {
    const { onComplete, onExit, tour } = threeStepTour();
    tour.start();

    button('Close')?.click();

    expect(onExit).toHaveBeenCalledOnce();
    expect(onComplete).not.toHaveBeenCalled();
    expectNoTourNodes();
  });
});

describe('missing targets', () => {
  test('skips unmatched and invalid targets and leaves them out of the count', () => {
    const tour = createTour({
      steps: [
        { target: '#nope', title: 'Unmatched' },
        { target: '#a', title: 'Title A' },
        { target: '##(', title: 'Invalid' },
        { target: '#b', title: 'Title B' },
      ],
    });

    tour.start();
    expect(text()).toContain('Title A');
    expect(text()).toContain('Step 1 of 2');
    expect(button('Back')?.disabled).toBe(true);

    tour.next();
    expect(text()).toContain('Title B');
    expect(text()).toContain('Step 2 of 2');
    expect(button('Done')).toBeDefined();

    tour.previous();
    expect(text()).toContain('Title A');
  });

  test.each([
    ['no steps', []],
    ['only missing targets', [{ target: '#nope', title: 'Unmatched' }]],
  ])('start() returns false with %s', (_name, steps) => {
    const { tour, onComplete, onExit } = threeStepTour({ steps });

    expect(tour.start()).toBe(false);

    expectNoTourNodes();
    expect(onComplete).not.toHaveBeenCalled();
    expect(onExit).not.toHaveBeenCalled();
  });

  test('moves on when the current target disappears', () => {
    const { tour } = threeStepTour();
    tour.start();

    document.querySelector('#a')?.remove();
    window.dispatchEvent(new Event('scroll'));

    expect(text()).toContain('Title B');
    expect(tooltipNode()).not.toBeNull();
  });

  test('exits when the last target disappears', () => {
    const { tour, onComplete, onExit } = threeStepTour();
    tour.start();
    tour.next();
    tour.next();

    document.querySelector('#c')?.remove();
    window.dispatchEvent(new Event('resize'));

    expect(onExit).toHaveBeenCalledOnce();
    expect(onComplete).not.toHaveBeenCalled();
    expectNoTourNodes();
  });
});

describe('target identity', () => {
  const overlayStyle = () =>
    document.querySelector<HTMLElement>('[data-guidely-spotlight]')?.style;

  test('displays the element resolved for the step if the selector later matches another', () => {
    const { element: original } = addTarget('selected');
    const replacement = document.createElement('div');
    replacement.id = 'selected';
    const replacementRect = vi.fn(() => new DOMRect(10, 20, 100, 50));
    replacement.getBoundingClientRect = replacementRect;
    original.scrollIntoView = vi.fn(() => {
      document.body.prepend(replacement);
    });

    createTour({ steps: [{ target: '#selected', title: 'Selected' }] }).start();
    window.dispatchEvent(new Event('scroll'));

    // Cutout and tooltip both derive from the original box at (400, 300).
    expect(overlayStyle()?.clipPath).toContain('M396 292');
    expect(tooltipNode()?.style.top).toBe('366px');
    expect(replacementRect).not.toHaveBeenCalled();
  });

  test('advances without stale nodes when each current target is removed', () => {
    const position = (id: string, top: number) => {
      const element = document.querySelector<HTMLElement>(`#${id}`)!;
      element.getBoundingClientRect = () => new DOMRect(400, top, 100, 50);
    };
    position('b', 200);
    position('c', 100);
    const { onExit, tour } = threeStepTour();
    tour.start();

    document.querySelector('#a')?.remove();
    window.dispatchEvent(new Event('scroll'));
    expect(document.querySelectorAll('[data-guidely-tooltip]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-guidely-spotlight]')).toHaveLength(
      1,
    );
    expect(overlayStyle()?.clipPath).toContain('M396 192');

    // Now that the components remounted, the tour's listener runs first.
    document.querySelector('#b')?.remove();
    window.dispatchEvent(new Event('scroll'));
    expect(document.querySelectorAll('[data-guidely-tooltip]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-guidely-spotlight]')).toHaveLength(
      1,
    );
    expect(overlayStyle()?.clipPath).toContain('M396 92');
    expect(onExit).not.toHaveBeenCalled();
  });

  test('start() returns false if the target goes away while being displayed', () => {
    const { element } = addTarget('fleeting');
    element.scrollIntoView = vi.fn(() => element.remove());
    const { tour, onComplete, onExit } = threeStepTour({
      steps: [{ target: element, title: 'Fleeting' }],
    });

    expect(tour.start()).toBe(false);

    expectNoTourNodes();
    expect(onComplete).not.toHaveBeenCalled();
    expect(onExit).not.toHaveBeenCalled();
    // Nothing is left running, so the same tour can try again.
    document.body.append(element);
    element.scrollIntoView = vi.fn();
    expect(tour.start()).toBe(true);
  });

  test('next() exits if the target goes away while being displayed', () => {
    const { tour, onComplete, onExit } = threeStepTour();
    tour.start();
    const b = document.querySelector<HTMLElement>('#b')!;
    b.scrollIntoView = vi.fn(() => b.remove());

    tour.next();

    expect(onExit).toHaveBeenCalledOnce();
    expect(onComplete).not.toHaveBeenCalled();
    expectNoTourNodes();
  });
});

describe('focus', () => {
  test('stays on the activated button across steps', () => {
    threeStepTour().tour.start();

    button('Next')?.focus();
    button('Next')?.click();

    expect(document.activeElement).toBe(button('Next'));
  });

  test('moves to Next when Back becomes disabled', () => {
    const { tour } = threeStepTour();
    tour.start();
    tour.next();

    button('Back')?.focus();
    button('Back')?.click();

    expect(document.activeElement).toBe(button('Next'));
  });
});

describe('lifecycle', () => {
  test('methods are safe before start and after destroy', () => {
    const { tour, onComplete, onExit } = threeStepTour();

    expect(() => {
      tour.next();
      tour.previous();
      tour.destroy();
      tour.destroy();
    }).not.toThrow();
    expectNoTourNodes();
    expect(onComplete).not.toHaveBeenCalled();
    expect(onExit).not.toHaveBeenCalled();
  });

  test('start() while running stays on the current step', () => {
    const { tour } = threeStepTour();
    tour.start();
    tour.next();

    expect(tour.start()).toBe(true);

    expect(text()).toContain('Title B');
    expect(document.querySelectorAll('[data-guidely-tooltip]')).toHaveLength(1);
  });

  test('destroy() removes everything without calling callbacks', () => {
    const { tour, onComplete, onExit } = threeStepTour();
    tour.start();

    tour.destroy();

    expectNoTourNodes();
    expect(onComplete).not.toHaveBeenCalled();
    expect(onExit).not.toHaveBeenCalled();
  });

  test('can start again from the first step after ending', () => {
    const { tour } = threeStepTour();
    tour.start();
    tour.next();
    tour.destroy();

    tour.start();

    expect(text()).toContain('Title A');
    expect(text()).toContain('Step 1 of 3');
  });

  test('a callback can restart the tour', () => {
    const tour = createTour({
      steps: [{ target: '#a', title: 'Title A' }],
      onExit: () => tour.start(),
    });
    tour.start();

    button('Close')?.click();

    expect(text()).toContain('Title A');
  });

  test('repeated cycles do not accumulate nodes or listeners', () => {
    const { tour } = threeStepTour();
    const rect = vi.mocked(document.querySelector('#a')!.getBoundingClientRect);
    const readsPerScroll = () => {
      rect.mockClear();
      window.dispatchEvent(new Event('scroll'));
      return rect.mock.calls.length;
    };

    tour.start();
    const baseline = readsPerScroll();
    tour.destroy();

    for (let i = 0; i < 3; i++) {
      tour.start();
      button('Close')?.click();
    }
    expectNoTourNodes();
    expect(readsPerScroll()).toBe(0);

    tour.start();
    expect(readsPerScroll()).toBe(baseline);
    expect(document.querySelectorAll('[data-guidely-tooltip]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-guidely-spotlight]')).toHaveLength(
      1,
    );
  });
});
