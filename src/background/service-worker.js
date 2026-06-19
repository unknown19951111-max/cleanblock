import { ALARM_UPDATE_CHECK, UPDATE_CHECK_INTERVAL_MINUTES } from './constants.js';
import { getStats } from './stats.js';
import { getUpdateState, getLastKnownGoodRuleset, getRollbackState } from './update-state.js';
import { getAllowlist, addAllowlistDomain, removeAllowlistDomain } from './allowlist.js';
import { initializeStorage } from './storage-init.js';

// --- Alarms ---

function ensureUpdateAlarm() {
  chrome.alarms.get(ALARM_UPDATE_CHECK, (alarm) => {
    if (!alarm) {
      chrome.alarms.create(ALARM_UPDATE_CHECK, {
        periodInMinutes: UPDATE_CHECK_INTERVAL_MINUTES
      });
    }
  });
}

// --- Lifecycle ---

chrome.runtime.onInstalled.addListener(async (details) => {
  await initializeStorage();
  ensureUpdateAlarm();
});

chrome.runtime.onStartup.addListener(async () => {
  await initializeStorage();
  ensureUpdateAlarm();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_UPDATE_CHECK) {
    // Signed update check will be implemented in Steps 7-9.
  }
});

// --- Message Handling ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_HEALTH') {
    (async () => {
      const stats = await getStats();
      const data = await chrome.storage.local.get(['extension_version', 'ruleset_health']);
      const updateState = await getUpdateState();
      const lkg = await getLastKnownGoodRuleset();
      const rollback = await getRollbackState();
      sendResponse({
        stats,
        extension_version: data.extension_version || '0.0.0',
        ruleset_health: data.ruleset_health || {},
        update_state: updateState,
        last_known_good_ruleset: lkg,
        rollback_state: rollback
      });
    })();
    return true;
  }

  if (message.type === 'GET_ALLOWLIST') {
    getAllowlist().then((list) => {
      sendResponse({ list });
    });
    return true;
  }

  if (message.type === 'ADD_ALLOWLIST_DOMAIN') {
    addAllowlistDomain(message.domain).then((result) => {
      sendResponse(result);
    });
    return true;
  }

  if (message.type === 'REMOVE_ALLOWLIST_DOMAIN') {
    removeAllowlistDomain(message.domain).then((result) => {
      sendResponse(result);
    });
    return true;
  }

});
