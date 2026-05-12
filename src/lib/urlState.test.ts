import assert from 'node:assert/strict';
import test from 'node:test';
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
    btoa: (value: string) => Buffer.from(value, 'binary').toString('base64'),
    atob: (value: string) => Buffer.from(value, 'base64').toString('binary'),
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
    scenarioName: 'Stress test',
    scenarioInputs: {
      sanctionShock: 20,
      treatyShift: -10,
      electionVolatility: 15,
      invasionPressure: 30,
      coupRisk: 5,
    },
    weightSetKey: 'baseline',
    activeEventIds: ['global-recession'],
    timelineIndex: 2,
    selectedCountry: 'United States of America',
  };

  const hash = encodeStateToHash(state);
  globalThis.window.location.hash = hash;
  const decoded = decodeStateFromHash();
  assert.deepEqual(decoded, state);
});

test('buildShareableUrl and clearHash update URL state safely', () => {
  const state: ShareableState = {
    scenarioName: 'Baseline+',
    scenarioInputs: {
      sanctionShock: 0,
      treatyShift: 0,
      electionVolatility: 0,
      invasionPressure: 0,
      coupRisk: 0,
    },
    weightSetKey: 'baseline',
    activeEventIds: [],
    timelineIndex: 0,
    selectedCountry: 'China',
  };

  const url = buildShareableUrl(state);
  assert.ok(url.startsWith('https://example.com/realpolitik?mode=test#scenario='));

  let replaced = '';
  globalThis.history.replaceState = (_state, _title, nextUrl) => {
    replaced = String(nextUrl ?? '');
    globalThis.window.location.hash = '';
  };
  globalThis.window.location.hash = '#scenario=abc';
  clearHash();
  assert.equal(replaced, '/realpolitik?mode=test');
});
