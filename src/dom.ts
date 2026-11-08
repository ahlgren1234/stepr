export function resolve(target: string | Element): Element | null {
  if (typeof target !== 'string') return target;
  try {
    return document.querySelector(target);
  } catch {
    // An invalid selector is treated like one that matches nothing.
    return null;
  }
}

export function measure(element: Element): DOMRect | undefined {
  if (!element.isConnected) return undefined;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 || rect.height > 0 ? rect : undefined;
}

/** Calls `callback` on scroll and resize until the controller is aborted. */
export function onViewportChange(callback: () => void): AbortController {
  const controller = new AbortController();
  const { signal } = controller;
  // Scroll events don't bubble, so capture also catches nested scrollers.
  window.addEventListener('scroll', callback, {
    capture: true,
    passive: true,
    signal,
  });
  window.addEventListener('resize', callback, { signal });
  return controller;
}
