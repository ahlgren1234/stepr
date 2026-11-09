// Runs the copy script from the real page. Browser behavior such as layout and
// key handling needs a real browser, so it isn't covered here.
import { readFileSync } from 'node:fs';
import { Window } from 'happy-dom';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const FAILURE = "Couldn't copy. Select the command and copy it manually.";

function loadPage(clipboard) {
  const { document } = new Window();
  document.write(readFileSync('demo/index.html', 'utf8'));
  const script = document.querySelector('script[data-install-copy]');
  new Function('document', 'navigator', script.textContent)(document, {
    clipboard,
  });
  return {
    button: document.querySelector('#install-copy'),
    status: document.querySelector('#install-status'),
  };
}

/** Clicks the button and lets the clipboard promise settle. */
async function click(button) {
  button.click();
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test('is a labelled button with a status region', () => {
  const { button, status } = loadPage({ writeText: vi.fn() });
  expect(button.getAttribute('type')).toBe('button');
  expect(button.getAttribute('aria-label')).toBe('Copy install command');
  expect(status.getAttribute('role')).toBe('status');
});

test('copies exactly the command and confirms it, then resets', async () => {
  const writeText = vi.fn(() => Promise.resolve());
  const { button, status } = loadPage({ writeText });

  await click(button);
  expect(writeText).toHaveBeenCalledExactlyOnceWith('npm install stepr');
  expect(status.textContent).toBe('Copied!');
  expect(button.classList.contains('copied')).toBe(true);

  await vi.advanceTimersByTimeAsync(2000);
  expect(status.textContent).toBe('');
  expect(button.classList.contains('copied')).toBe(false);
});

test('copying again restarts the confirmation', async () => {
  const { button, status } = loadPage({
    writeText: () => Promise.resolve(),
  });

  await click(button);
  await vi.advanceTimersByTimeAsync(1500);
  await click(button);
  await vi.advanceTimersByTimeAsync(1500);
  expect(status.textContent).toBe('Copied!');

  await vi.advanceTimersByTimeAsync(500);
  expect(status.textContent).toBe('');
});

test('reports a failure when the clipboard rejects, and keeps it', async () => {
  const { button, status } = loadPage({
    writeText: () => Promise.reject(new Error('denied')),
  });

  await click(button);
  await vi.advanceTimersByTimeAsync(10000);
  expect(status.textContent).toBe(FAILURE);
  expect(button.classList.contains('copied')).toBe(false);
});

test('reports a failure when the Clipboard API is missing', async () => {
  const { button, status } = loadPage(undefined);

  await click(button);
  expect(status.textContent).toBe(FAILURE);
});

test('a retry after a failure can succeed', async () => {
  const writeText = vi
    .fn()
    .mockRejectedValueOnce(new Error('denied'))
    .mockResolvedValueOnce();
  const { button, status } = loadPage({ writeText });

  await click(button);
  expect(status.textContent).toBe(FAILURE);
  await click(button);
  expect(status.textContent).toBe('Copied!');
});

test('a slower earlier attempt does not overwrite the latest result', async () => {
  let rejectFirst;
  const writeText = vi
    .fn()
    .mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectFirst = reject;
      }),
    )
    .mockResolvedValueOnce();
  const { button, status } = loadPage({ writeText });

  button.click();
  await click(button);
  expect(status.textContent).toBe('Copied!');

  rejectFirst(new Error('denied'));
  await vi.advanceTimersByTimeAsync(0);
  expect(status.textContent).toBe('Copied!');
});
