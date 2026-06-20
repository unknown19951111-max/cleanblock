import { STATIC_RULESETS } from './constants.js';
import { createDefaultStats, saveStats, getStats } from './stats.js';
import { getRollbackState, createDefaultRollbackState, saveRollbackState } from './update-state.js';

export async function initializeStorage() {
  const { stats } = await chrome.storage.local.get('stats');
  if (!stats) {
    await saveStats(createDefaultStats());
  }

  const currentStats = await getStats();
  const rollback = await getRollbackState();
  if (currentStats.rollback_active !== rollback.rollback_active) {
    currentStats.rollback_active = rollback.rollback_active;
    currentStats.rollback_reason = rollback.rollback_reason || null;
    await saveStats(currentStats);
  }

  const manifest = chrome.runtime.getManifest();
  await chrome.storage.local.set({ extension_version: manifest.version });

  const rulesetHealth = {};
  for (const id of STATIC_RULESETS) {
    rulesetHealth[id] = { enabled: true, source: 'static' };
  }
  await chrome.storage.local.set({ ruleset_health: rulesetHealth });
}
