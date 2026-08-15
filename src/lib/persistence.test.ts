import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPersistedState, savePersistedState } from './persistence';
import type { PersistedState } from './persistence';

const STORAGE_KEY = 'realpolitik:state';
const originalWindow = globalThis.window;

class MockStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }

  clear() {
    this.store.clear();
  }

  key(index: number) {
    return [...this.store.keys()][index] ?? null;
  }

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }

  removeItem(key: string) {
    this.store.delete(key);
  }
}

test.beforeEach(() => {
  const localStorage = new MockStorage();
  Object.assign(globalThis, {
    window: {
      localStorage,
    } as unknown as Window,
  });
});

test.after(() => {
  Object.assign(globalThis, { window: originalWindow });
});

test('savePersistedState/loadPersistedState round-trips valid state', () => {
  const state: Omit<PersistedState, 'version'> = {
    selectedCountry: 'United States of America',
    filters: {
      allianceNetwork: 'all',
      tradeExposure: 'all',
      militaryTreatyLevel: 'all',
      conflictPressure: 'all',
      sanctionsExposure: 'all',
      regimeType: 'all',
      riskLevel: 'all',
    },
    overlayMode: 'none',
    mapFillMode: 'alignment',
    inspectorTab: 'compare',
    drawerTab: 'methodology',
    drawerOpen: true,
    drawerHeight: 320,
  };

  savePersistedState(state);
  const loaded = loadPersistedState();
  assert.deepEqual(loaded, { version: 2, ...state });
});

test('loadPersistedState ignores mismatched storage version', () => {
  globalThis.window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 999, selectedCountry: 'China' }));
  const loaded = loadPersistedState();
  assert.equal(loaded, null);
});
