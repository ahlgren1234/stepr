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
  document.querySelector<HTMLElement>('[data-stepr-tooltip]');
const overlayNode = () => document.querySelector('[data-stepr-spotlight]');
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

const statusNode = () => document.querySelector('[data-stepr-status]');

function expectNoTourNodes() {
  expect(tooltipNode()).toBeNull();
  expect(overlayNode()).toBeNull();
  expect(statusNode()).toBeNull();
}

function addOrigin(id = 'origin') {
  const element = document.createElement('button');
  element.id = id;
  document.body.append(element);
  element.focus();
  return element;
}

function press(key: string, init: KeyboardEventInit = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  });
  (document.activeElement ?? document.body).dispatchEvent(event);
  return event;
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
    document.querySelector<HTMLElement>('[data-stepr-spotlight]')?.style;

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
    expect(document.querySelectorAll('[data-stepr-tooltip]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-stepr-spotlight]')).toHaveLength(1);
    expect(overlayStyle()?.clipPath).toContain('M396 192');

    // Now that the components remounted, the tour's listener runs first.
    document.querySelector('#b')?.remove();
    window.dispatchEvent(new Event('scroll'));
    expect(document.querySelectorAll('[data-stepr-tooltip]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-stepr-spotlight]')).toHaveLength(1);
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

describe('focus entry and restoration', () => {
  test('start() moves focus to Next from the element that started it', () => {
    addOrigin();
    threeStepTour().tour.start();

    expect(document.activeElement).toBe(button('Next'));
  });

  test('start() returning false leaves focus alone', () => {
    const origin = addOrigin();
    const { tour } = threeStepTour({ steps: [] });

    expect(tour.start()).toBe(false);

    expect(document.activeElement).toBe(origin);
  });

  test.each([
    ['Close', () => button('Close')?.click()],
    ['Escape', () => press('Escape')],
    ['destroy()', (tour: Tour) => tour.destroy()],
  ])('%s restores focus to the origin', (_name, exit) => {
    const origin = addOrigin();
    const { tour } = threeStepTour();
    tour.start();

    exit(tour);

    expect(document.activeElement).toBe(origin);
  });

  test('completing the tour restores focus', () => {
    const origin = addOrigin();
    const { tour } = threeStepTour();
    tour.start();
    tour.next();
    tour.next();

    button('Done')?.click();

    expect(document.activeElement).toBe(origin);
  });

  test('restores focus when the last target disappears', () => {
    const origin = addOrigin();
    const { tour } = threeStepTour();
    tour.start();
    tour.next();
    tour.next();

    document.querySelector('#c')?.remove();
    window.dispatchEvent(new Event('scroll'));

    expect(document.activeElement).toBe(origin);
  });

  test('does not take focus back from another page element', () => {
    addOrigin();
    const { tour } = threeStepTour();
    tour.start();
    const other = addOrigin('other');

    tour.destroy();

    expect(document.activeElement).toBe(other);
  });

  test('tolerates an origin removed during the tour', () => {
    const origin = addOrigin();
    const { tour } = threeStepTour();
    tour.start();
    origin.remove();

    tour.destroy();

    expect(document.activeElement).toBe(document.body);
  });

  test('a callback can move focus after restoration', () => {
    addOrigin();
    const destination = document.createElement('button');
    document.body.append(destination);
    const { tour } = threeStepTour({ onExit: () => destination.focus() });
    tour.start();

    press('Escape');

    expect(document.activeElement).toBe(destination);
  });

  test('keeps focus in the tour when the tooltip removes itself', () => {
    const { tour } = threeStepTour();
    tour.start();
    expect(document.activeElement).toBe(button('Next'));

    // On the first step the tooltip's listener runs before the tour's.
    document.querySelector('#a')?.remove();
    window.dispatchEvent(new Event('scroll'));

    expect(text()).toContain('Title B');
    expect(document.activeElement).toBe(button('Next'));
  });

  test('does not pull focus from the page when moving between steps', () => {
    const { tour } = threeStepTour();
    tour.start();
    const other = addOrigin('other');

    tour.next();

    expect(document.activeElement).toBe(other);
  });
});

describe('keyboard', () => {
  test('Escape exits once and does not complete', () => {
    const { tour, onComplete, onExit } = threeStepTour();
    tour.start();

    const event = press('Escape');
    press('Escape');

    expect(event.defaultPrevented).toBe(true);
    expect(onExit).toHaveBeenCalledOnce();
    expect(onComplete).not.toHaveBeenCalled();
    expectNoTourNodes();
  });

  test('Escape works with focus outside the tour', () => {
    const { tour, onExit } = threeStepTour();
    tour.start();
    addOrigin('other');

    press('Escape');

    expect(onExit).toHaveBeenCalledOnce();
  });

  test('Escape leaves the page alone when no tour is running', () => {
    const { tour, onExit } = threeStepTour();
    tour.start();
    tour.destroy();

    const event = press('Escape');

    expect(event.defaultPrevented).toBe(false);
    expect(onExit).not.toHaveBeenCalled();
  });

  test('Escape claimed by the page does not exit', () => {
    const { tour, onExit } = threeStepTour();
    tour.start();
    const popup = addOrigin('popup');
    popup.addEventListener('keydown', (event) => event.preventDefault());

    press('Escape');

    expect(onExit).not.toHaveBeenCalled();
    expect(tooltipNode()).not.toBeNull();
  });

  test('Escape during text composition does not exit', () => {
    const { tour, onExit } = threeStepTour();
    tour.start();

    press('Escape', { isComposing: true });

    expect(onExit).not.toHaveBeenCalled();
  });

  test.each([
    ['Shift+Tab from the first control', 'Next', { shiftKey: true }],
    ['Tab from the last control', 'Close', {}],
  ])('%s is left to the browser', (_name, label, init) => {
    threeStepTour().tour.start();
    button(label)?.focus();

    expect(press('Tab', init).defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(button(label));
  });

  test('focus can leave the controls for the target without ending the tour', () => {
    const { tour, onExit } = threeStepTour();
    tour.start();
    const target = document.querySelector<HTMLElement>('#a')!;
    target.tabIndex = 0;

    expect(press('Tab', { shiftKey: true }).defaultPrevented).toBe(false);
    // Moving focus is the browser's default action, which happy-dom lacks.
    target.focus();

    expect(tooltipNode()).not.toBeNull();
    tour.next();
    expect(document.activeElement).toBe(target);

    press('Escape');
    expect(onExit).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(target);
  });
});

describe('screen reader semantics', () => {
  test('the tooltip is a named, described, non-modal dialog', () => {
    threeStepTour().tour.start();
    const dialog = tooltipNode();

    expect(dialog?.getAttribute('role')).toBe('dialog');
    expect(dialog?.getAttribute('aria-label')).toBe('Title A: Step 1 of 3');
    expect(dialog?.hasAttribute('aria-modal')).toBe(false);
    const description = document.getElementById(
      dialog?.getAttribute('aria-describedby') ?? '',
    );
    expect(description?.textContent).toBe('Description A');
  });

  test('a step without a title is named by its position', () => {
    const { tour } = threeStepTour();
    tour.start();
    tour.next();
    tour.next();

    expect(tooltipNode()?.getAttribute('aria-label')).toBe('Step 3 of 3');
  });

  test('drops the description reference on a step without one', () => {
    const { tour } = threeStepTour();
    tour.start();

    tour.next();

    expect(tooltipNode()?.hasAttribute('aria-describedby')).toBe(false);
  });

  test('announces step changes but not the first step', () => {
    const { tour } = threeStepTour();
    tour.start();
    expect(statusNode()?.getAttribute('role')).toBe('status');
    expect(statusNode()?.textContent).toBe('');

    tour.next();
    expect(statusNode()?.textContent).toBe('Title B: Step 2 of 3');

    tour.previous();
    expect(statusNode()?.textContent).toBe(
      'Title A: Step 1 of 3. Description A',
    );
  });

  test('a restarted tour does not repeat the last announcement', () => {
    const { tour } = threeStepTour();
    tour.start();
    tour.next();
    tour.destroy();

    tour.start();

    expect(statusNode()?.textContent).toBe('');
  });
});

describe('reduced motion', () => {
  const scrollBehavior = () =>
    vi.mocked(document.querySelector('#a')!.scrollIntoView).mock.calls[0]?.[0];

  test.each([
    [true, 'instant'],
    [false, 'auto'],
  ])('scrolls when reduce is %s with behavior %s', (matches, behavior) => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) => ({ matches, media: query }) as MediaQueryList,
    );

    threeStepTour().tour.start();

    expect(window.matchMedia).toHaveBeenCalledWith(
      '(prefers-reduced-motion: reduce)',
    );
    expect(scrollBehavior()).toMatchObject({ behavior });
  });

  test('restoring focus does not animate a scroll', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      matches: true,
    } as MediaQueryList);
    const origin = addOrigin();
    origin.scrollIntoView = vi.fn();
    const focus = vi.spyOn(origin, 'focus');
    const { tour } = threeStepTour();
    tour.start();

    press('Escape');

    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(document.activeElement).toBe(origin);
    expect(origin.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'instant',
      block: 'nearest',
    });
  });

  test('works where matchMedia is unavailable', () => {
    vi.stubGlobal('matchMedia', undefined);

    expect(threeStepTour().tour.start()).toBe(true);

    vi.unstubAllGlobals();
    expect(scrollBehavior()).toMatchObject({ behavior: 'auto' });
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
    expect(document.querySelectorAll('[data-stepr-tooltip]')).toHaveLength(1);
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
    expect(document.querySelectorAll('[data-stepr-tooltip]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-stepr-spotlight]')).toHaveLength(1);
  });
});
