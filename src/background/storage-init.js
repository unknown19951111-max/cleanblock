import { STATIC_RULESETS } from './constants.js';
import { createDefaultStats, saveStats } from './stats.js';

export async function initializeStorage() {
  const { stats } = await chrome.storage.local.get('stats');
  if (!stats) {
    await saveStats(createDefaultStats());
  }

  const manifest = chrome.runtime.getManifest();
  await chrome.storage.local.set({ extension_version: manifest.version });

  const rulesetHealth = {};
  for (const id of STATIC_RULESETS) {
    rulesetHealth[id] = { enabled: true, source: 'static' };
  }
  await chrome.storage.local.set({ ruleset_health: rulesetHealth });
}
