export function createDefaultStats() {
  return {
    ruleset_version: 1,
    ruleset_source: 'static',
    last_update_check: null,
    last_update_status: 'none',
    rollback_active: false,
    rollback_reason: null
  };
}

export async function getStats() {
  const { stats } = await chrome.storage.local.get('stats');
  return stats || createDefaultStats();
}

export async function saveStats(stats) {
  await chrome.storage.local.set({ stats });
}
