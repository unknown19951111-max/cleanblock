import { getStats, saveStats } from './stats.js';

export function createDefaultUpdateState() {
  return {
    current_ruleset_version: 1,
    current_ruleset_source: 'static',
    last_check_at: null,
    last_success_at: null,
    last_failure_at: null,
    last_failure_stage: null,
    last_failure_errors: [],
    consecutive_failures: 0
  };
}

export function createDefaultLastKnownGoodRuleset() {
  return {
    ruleset_version: 1,
    source: 'static',
    activated_at: null,
    files: []
  };
}

export function createDefaultRollbackState() {
  return {
    rollback_active: false,
    rollback_reason: null,
    rolled_back_at: null,
    previous_ruleset_version: null,
    restored_ruleset_version: null
  };
}

export async function getUpdateState() {
  const { update_state } = await chrome.storage.local.get('update_state');
  return update_state || createDefaultUpdateState();
}

export async function saveUpdateState(state) {
  await chrome.storage.local.set({ update_state: state });
}

export async function getLastKnownGoodRuleset() {
  const { last_known_good_ruleset } = await chrome.storage.local.get('last_known_good_ruleset');
  return last_known_good_ruleset || createDefaultLastKnownGoodRuleset();
}

export async function saveLastKnownGoodRuleset(state) {
  await chrome.storage.local.set({ last_known_good_ruleset: state });
}

export async function getRollbackState() {
  const { rollback_state } = await chrome.storage.local.get('rollback_state');
  return rollback_state || createDefaultRollbackState();
}

export async function saveRollbackState(state) {
  await chrome.storage.local.set({ rollback_state: state });
}

export async function recordUpdateValidationFailure(stage, errors) {
  const state = await getUpdateState();
  state.consecutive_failures += 1;
  state.last_failure_at = new Date().toISOString();
  state.last_failure_stage = stage;
  state.last_failure_errors = errors;
  state.last_check_at = new Date().toISOString();
  await saveUpdateState(state);
  return state;
}

export async function recordUpdateValidationSuccess(result) {
  const state = await getUpdateState();
  state.consecutive_failures = 0;
  state.current_ruleset_version = result.ruleset_version;
  state.current_ruleset_source = 'signed_update';
  state.last_success_at = new Date().toISOString();
  state.last_check_at = new Date().toISOString();
  state.last_failure_stage = null;
  state.last_failure_errors = [];
  await saveUpdateState(state);
  return state;
}

export async function activateRollback(reason) {
  const updateState = await getUpdateState();
  const lkg = await getLastKnownGoodRuleset();

  const rollback = {
    rollback_active: true,
    rollback_reason: reason,
    rolled_back_at: new Date().toISOString(),
    previous_ruleset_version: updateState.current_ruleset_version,
    restored_ruleset_version: lkg.ruleset_version
  };
  await saveRollbackState(rollback);

  updateState.current_ruleset_version = lkg.ruleset_version;
  updateState.current_ruleset_source = 'last_known_good';
  await saveUpdateState(updateState);

  const stats = await getStats();
  stats.rollback_active = true;
  stats.rollback_reason = reason;
  await saveStats(stats);

  return rollback;
}

export async function clearRollbackState() {
  await saveRollbackState(createDefaultRollbackState());

  const stats = await getStats();
  stats.rollback_active = false;
  stats.rollback_reason = null;
  await saveStats(stats);
}
