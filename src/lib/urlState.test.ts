import assert from 'node:assert/strict';
import test from 'node:test';
import { atob, btoa } from 'node:buffer';
import {
  buildShareableUrl,
  clearHash,
  decodeStateFromHash,
  encodeStateToHash,
  type ShareableState,
} from './urlState';

const originalWindow = globalThis.window;
const originalHistory = globalThis.history;

const createMockWindow = () => {
  const location = {
    hash: '',
    origin: 'https://example.com',
    pathname: '/realpolitik',
    search: '?mode=test',
  };
  return {
    location,
    btoa: (value: string) => btoa(value),
    atob: (value: string) => atob(value),
  } as unknown as Window;
};

test.beforeEach(() => {
  const mockWindow = createMockWindow();
  const mockHistory = { replaceState: () => undefined } as unknown as History;
  Object.assign(globalThis, { window: mockWindow, history: mockHistory });
});

test.after(() => {
  Object.assign(globalThis, { window: originalWindow, history: originalHistory });
});

test('encode/decode state through URL hash is lossless', () => {
  const state: ShareableState = {
    selectedCountry: 'United States of America',
  };

  const hash = encodeStateToHash(state);
  globalThis.window.location.hash = hash;
  const decoded = decodeStateFromHash();
  assert.deepEqual(decoded, state);
});

test('share state can preserve the current map reading modes', () => {
  const state: ShareableState = {
    selectedCountry: 'China',
    overlayMode: 'dependency',
    mapFillMode: 'gdpGrowth',
  };
  globalThis.window.location.hash = encodeStateToHash(state);
  assert.deepEqual(decodeStateFromHash(), state);
});

test('buildShareableUrl and clearHash update URL state safely', () => {
  const state: ShareableState = {
    selectedCountry: 'China',
  };

  const url = buildShareableUrl(state);
  assert.ok(url.startsWith('https://example.com/realpolitik?mode=test#state='));

  let replaced = '';
  globalThis.history.replaceState = (_state, _title, nextUrl) => {
    replaced = String(nextUrl ?? '');
    globalThis.window.location.hash = '';
  };
  globalThis.window.location.hash = '#state=abc';
  clearHash();
  assert.equal(replaced, '/realpolitik?mode=test');
});

test('oversized or unbounded shared state is rejected before decoding', () => {
  globalThis.window.location.hash = `#state=${'A'.repeat(4096)}`;
  assert.equal(decodeStateFromHash(), null);

  const oversizedCountry = { selectedCountry: 'A'.repeat(101) };
  globalThis.window.location.hash = `#state=${btoa(JSON.stringify(oversizedCountry))}`;
  assert.equal(decodeStateFromHash(), null);
});
