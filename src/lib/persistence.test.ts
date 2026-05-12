import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPersistedState, parseScenariosFile, savePersistedState } from './persistence';
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
    scenarioName: 'Baseline+',
    scenarioInputs: {
      sanctionShock: 10,
      treatyShift: 0,
      electionVolatility: 15,
      invasionPressure: 20,
      coupRisk: 5,
    },
    weightSetKey: 'baseline',
    activeEventIds: ['global-recession'],
    savedScenarios: [],
    filters: {
      allianceNetwork: 'all',
      tradeExposure: 'all',
      militaryTreatyLevel: 'all',
      conflictPressure: 'all',
      sanctionsExposure: 'all',
      regimeType: 'all',
      riskLevel: 'all',
    },
    timelineIndex: 1,
    overlayMode: 'none',
    mapFillMode: 'alignment',
    inspectorTab: 'stats',
    drawerTab: 'analysis',
    drawerOpen: true,
    drawerHeight: 320,
    comparisonScenarioId: null,
  };

  savePersistedState(state);
  const loaded = loadPersistedState();
  assert.deepEqual(loaded, { version: 1, ...state });
});

test('loadPersistedState ignores mismatched storage version', () => {
  globalThis.window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 999, selectedCountry: 'China' }));
  const loaded = loadPersistedState();
  assert.equal(loaded, null);
});

test('parseScenariosFile accepts valid exports', async () => {
  const file = new File(
    [
      JSON.stringify({
        type: 'realpolitik-scenarios',
        version: 1,
        exportedAt: '2026-05-01T00:00:00.000Z',
        datasetVersion: '0.13.0',
        scenarios: [
          {
            id: '1',
            name: 'Scenario 1',
            timelineIndex: 1,
            weightSetKey: 'baseline',
            inputs: {
              sanctionShock: 5,
              treatyShift: -5,
              electionVolatility: 5,
              invasionPressure: 5,
              coupRisk: 5,
            },
          },
        ],
      }),
    ],
    'scenarios.json',
    { type: 'application/json' },
  );

  const scenarios = await parseScenariosFile(file);
  assert.equal(scenarios.length, 1);
  assert.equal(scenarios[0]!.name, 'Scenario 1');
});
