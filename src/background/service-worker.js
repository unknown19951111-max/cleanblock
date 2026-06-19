'use strict';

const ALARM_UPDATE_CHECK = 'cleanblock-update-check';
const UPDATE_CHECK_INTERVAL_MINUTES = 360;

const STATIC_RULESETS = ['core_ads', 'privacy_trackers', 'annoyances'];

// --- Stats Engine ---

function createDefaultStats() {
  return {
    ruleset_version: 1,
    ruleset_source: 'static',
    last_update_check: null,
    last_update_status: 'none',
    rollback_active: false,
    rollback_reason: null
  };
}

async function getStats() {
  const { stats } = await chrome.storage.local.get('stats');
  return stats || createDefaultStats();
}

async function saveStats(stats) {
  await chrome.storage.local.set({ stats });
}


// --- SHA-256 Hash Verification (local only — no fetch, no transmission) ---

function textToArrayBuffer(text) {
  const encoder = new TextEncoder();
  return encoder.encode(text).buffer;
}

async function sha256HexFromText(text) {
  const buffer = textToArrayBuffer(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = new Uint8Array(hashBuffer);
  let hex = '';
  for (let i = 0; i < hashArray.length; i++) {
    hex += hashArray[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function constantTimeEqualHex(a, b) {
  const aNorm = String(a).toLowerCase();
  const bNorm = String(b).toLowerCase();
  if (aNorm.length !== bNorm.length) return false;
  let diff = 0;
  for (let i = 0; i < aNorm.length; i++) {
    diff |= aNorm.charCodeAt(i) ^ bNorm.charCodeAt(i);
  }
  return diff === 0;
}

async function verifyTextSha256(text, expectedHex) {
  if (typeof expectedHex !== 'string' || !/^[a-f0-9]{64}$/.test(expectedHex)) {
    return { ok: false, actual: null, error: 'expectedHex must be 64 lowercase hex characters' };
  }
  const actual = await sha256HexFromText(text);
  if (constantTimeEqualHex(actual, expectedHex)) {
    return { ok: true, actual };
  }
  return { ok: false, actual, error: 'Hash mismatch' };
}

// --- Ed25519 Signature Verification (local only — no fetch, no remote keys) ---

const SIGNING_KEYS = {
  'cleanblock-signing-key-v1': {
    algorithm: 'Ed25519',
    // Placeholder — replace with real base64-encoded Ed25519 public key before production use.
    publicKeyBase64: 'PLACEHOLDER_BASE64_PUBLIC_KEY'
  }
};

function getSigningKeyById(keyId) {
  return SIGNING_KEYS[keyId] || null;
}

function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

function canonicalizeManifestForSigning(manifest) {
  const canonFiles = manifest.files
    .map((file) => ({
      ruleset_id: file.ruleset_id,
      path: file.path,
      sha256: file.sha256,
      rule_count: file.rule_count,
      rule_type: file.rule_type
    }))
    .sort((a, b) => a.ruleset_id.localeCompare(b.ruleset_id));

  const canon = {
    manifest_version: manifest.manifest_version,
    ruleset_version: manifest.ruleset_version,
    created_at: manifest.created_at,
    min_extension_version: manifest.min_extension_version,
    files: canonFiles,
    signature: {
      algorithm: manifest.signature.algorithm,
      key_id: manifest.signature.key_id
    }
  };
  return JSON.stringify(canon);
}

async function verifyManifestSignature(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    return { ok: false, error: 'Manifest must be an object' };
  }
  if (!manifest.signature || typeof manifest.signature !== 'object') {
    return { ok: false, error: 'Missing signature object' };
  }
  if (manifest.signature.algorithm !== 'Ed25519') {
    return { ok: false, error: 'Unsupported algorithm: ' + manifest.signature.algorithm };
  }

  const keyMeta = getSigningKeyById(manifest.signature.key_id);
  if (!keyMeta) {
    return { ok: false, error: 'Unknown signing key_id: ' + manifest.signature.key_id };
  }
  if (!manifest.signature.value || typeof manifest.signature.value !== 'string') {
    return { ok: false, error: 'Missing or invalid signature value' };
  }

  let publicKeyData;
  let signatureData;
  try {
    publicKeyData = base64ToArrayBuffer(keyMeta.publicKeyBase64);
    signatureData = base64ToArrayBuffer(manifest.signature.value);
  } catch (e) {
    return { ok: false, error: 'Base64 decode failed: ' + e.message };
  }

  const canonicalText = canonicalizeManifestForSigning(manifest);
  const messageData = textToArrayBuffer(canonicalText);

  try {
    const publicKey = await crypto.subtle.importKey(
      'raw',
      publicKeyData,
      { name: 'Ed25519' },
      false,
      ['verify']
    );

    const valid = await crypto.subtle.verify(
      { name: 'Ed25519' },
      publicKey,
      signatureData,
      messageData
    );

    if (valid) {
      return { ok: true };
    }
    return { ok: false, error: 'Signature verification failed' };
  } catch (e) {
    if (e.name === 'NotSupportedError') {
      return { ok: false, error: 'Ed25519 verification unavailable in this runtime' };
    }
    return { ok: false, error: 'Verification error: ' + e.message };
  }
}

// --- Update Manifest Validation (Step 7 scaffold — no fetch, no crypto yet) ---

const ALLOWED_RULE_TYPES = ['dnr_dynamic_ruleset_update'];
const ALLOWED_MANIFEST_VERSION = 1;
const KNOWN_RULESET_IDS = ['core_ads', 'privacy_trackers', 'annoyances'];

const ALLOWED_UPDATE_MANIFEST_FIELDS = [
  'manifest_version', 'ruleset_version', 'created_at',
  'min_extension_version', 'files', 'signature'
];
const ALLOWED_UPDATE_FILE_DESCRIPTOR_FIELDS = [
  'ruleset_id', 'path', 'sha256', 'rule_count', 'rule_type'
];
const ALLOWED_SIGNATURE_FIELDS = ['algorithm', 'key_id', 'value'];

function isAllowedRuleType(ruleType) {
  return ALLOWED_RULE_TYPES.includes(ruleType);
}

function isMonotonicRulesetVersion(currentVersion, nextVersion) {
  return Number.isInteger(nextVersion) && nextVersion > currentVersion;
}

function validateRulesetFileDescriptor(file) {
  const errors = [];
  if (!file || typeof file !== 'object') return ['File descriptor must be an object'];

  errors.push(...validateObjectOnlyHasAllowedFields(file, ALLOWED_UPDATE_FILE_DESCRIPTOR_FIELDS, 'file'));

  if (typeof file.ruleset_id !== 'string' || !KNOWN_RULESET_IDS.includes(file.ruleset_id)) {
    errors.push('Unknown or missing ruleset_id: ' + file.ruleset_id);
  }
  if (typeof file.path !== 'string' || !file.path) {
    errors.push('Missing or empty path');
  }
  if (typeof file.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(file.sha256)) {
    errors.push('Invalid or missing sha256 hash');
  }
  if (!Number.isInteger(file.rule_count) || file.rule_count < 0) {
    errors.push('Invalid rule_count');
  }
  if (!isAllowedRuleType(file.rule_type)) {
    errors.push('Disallowed rule_type: ' + file.rule_type);
  }
  return errors;
}

function validateUpdateManifestShape(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') return ['Manifest must be an object'];

  errors.push(...validateObjectOnlyHasAllowedFields(manifest, ALLOWED_UPDATE_MANIFEST_FIELDS, 'manifest'));

  if (manifest.manifest_version !== ALLOWED_MANIFEST_VERSION) {
    errors.push('Unsupported manifest_version: ' + manifest.manifest_version);
  }
  if (!Number.isInteger(manifest.ruleset_version) || manifest.ruleset_version < 1) {
    errors.push('Invalid ruleset_version');
  }
  if (typeof manifest.created_at !== 'string' || !manifest.created_at) {
    errors.push('Missing created_at');
  }
  if (typeof manifest.min_extension_version !== 'string' || !manifest.min_extension_version) {
    errors.push('Missing min_extension_version');
  }
  if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
    errors.push('files must be a non-empty array');
  } else {
    manifest.files.forEach((file, i) => {
      const fileErrors = validateRulesetFileDescriptor(file);
      fileErrors.forEach((e) => errors.push('files[' + i + ']: ' + e));
    });
  }

  const sig = manifest.signature;
  if (!sig || typeof sig !== 'object') {
    errors.push('Missing signature object');
  } else {
    errors.push(...validateObjectOnlyHasAllowedFields(sig, ALLOWED_SIGNATURE_FIELDS, 'signature'));
    if (sig.algorithm !== 'Ed25519') {
      errors.push('Unsupported signature algorithm: ' + sig.algorithm);
    }
    if (typeof sig.key_id !== 'string' || !sig.key_id) {
      errors.push('Missing signature key_id');
    }
    if (typeof sig.value !== 'string' || !sig.value) {
      errors.push('Missing signature value');
    }
  }

  return errors;
}

// --- Remote DNR Rule-File Validation (local only — no fetch, no application) ---

const REMOTE_DYNAMIC_RULE_ID_START = 60000;
const REMOTE_DYNAMIC_RULE_ID_MAX = 89999;
const ALLOWED_REMOTE_DNR_ACTIONS = ['block', 'allow', 'upgradeScheme'];
const ALLOWED_REMOTE_RESOURCE_TYPES = [
  'script', 'image', 'xmlhttprequest', 'sub_frame',
  'stylesheet', 'font', 'media', 'ping', 'websocket'
];
const REJECTED_EXECUTABLE_FIELDS = [
  'script', 'code', 'function', 'eval', 'js', 'scriptlet', 'content_script'
];
const ALLOWED_REMOTE_RULE_FIELDS = ['id', 'priority', 'action', 'condition'];
const ALLOWED_REMOTE_ACTION_FIELDS = ['type'];
const ALLOWED_REMOTE_CONDITION_FIELDS = [
  'urlFilter', 'regexFilter',
  'requestDomains', 'excludedRequestDomains',
  'initiatorDomains', 'excludedInitiatorDomains',
  'resourceTypes', 'excludedResourceTypes',
  'domainType',
  'requestMethods', 'excludedRequestMethods'
];
const REJECTED_REMOTE_CONDITION_FIELDS = [
  'tabIds', 'excludedTabIds', 'responseHeaders', 'requestHeaders'
];

function validateObjectOnlyHasAllowedFields(obj, allowedFields, path) {
  const errors = [];
  for (const key of Object.keys(obj)) {
    if (!allowedFields.includes(key)) {
      errors.push(path + ': unexpected field "' + key + '"');
    }
  }
  return errors;
}

function containsRejectedExecutableField(value, path) {
  const errors = [];
  if (value === null || typeof value !== 'object') return errors;

  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      errors.push(...containsRejectedExecutableField(value[i], path + '[' + i + ']'));
    }
    return errors;
  }

  for (const key of Object.keys(value)) {
    if (REJECTED_EXECUTABLE_FIELDS.includes(key)) {
      errors.push(path + ': contains rejected executable field "' + key + '"');
    }
    errors.push(...containsRejectedExecutableField(value[key], path + '.' + key));
  }
  return errors;
}

function parseRulesetText(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return { ok: false, errors: ['Invalid JSON: ' + e.message] };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, errors: ['Top-level value must be an array'] };
  }
  return { ok: true, rules: parsed };
}

function validateRemoteDnrRule(rule, index) {
  const errors = [];
  const prefix = 'rule[' + index + ']';

  if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
    return [prefix + ': must be an object'];
  }

  errors.push(...containsRejectedExecutableField(rule, prefix));
  errors.push(...validateObjectOnlyHasAllowedFields(rule, ALLOWED_REMOTE_RULE_FIELDS, prefix));

  if (!Number.isInteger(rule.id)) {
    errors.push(prefix + '.id must be an integer');
  } else if (rule.id < REMOTE_DYNAMIC_RULE_ID_START || rule.id > REMOTE_DYNAMIC_RULE_ID_MAX) {
    errors.push(prefix + '.id ' + rule.id + ' outside allowed range ' + REMOTE_DYNAMIC_RULE_ID_START + '–' + REMOTE_DYNAMIC_RULE_ID_MAX);
  }

  if (!Number.isInteger(rule.priority) || rule.priority < 1) {
    errors.push(prefix + '.priority must be an integer >= 1');
  }

  if (!rule.action || typeof rule.action !== 'object') {
    errors.push(prefix + '.action must be an object');
  } else {
    if (!ALLOWED_REMOTE_DNR_ACTIONS.includes(rule.action.type)) {
      errors.push(prefix + '.action.type "' + rule.action.type + '" is not allowed');
    }
    errors.push(...validateObjectOnlyHasAllowedFields(rule.action, ALLOWED_REMOTE_ACTION_FIELDS, prefix + '.action'));
  }

  if (!rule.condition || typeof rule.condition !== 'object') {
    errors.push(prefix + '.condition must be an object');
  } else {
    for (const rejected of REJECTED_REMOTE_CONDITION_FIELDS) {
      if (rejected in rule.condition) {
        errors.push(prefix + '.condition: rejected field "' + rejected + '"');
      }
    }
    errors.push(...validateObjectOnlyHasAllowedFields(rule.condition, ALLOWED_REMOTE_CONDITION_FIELDS, prefix + '.condition'));

    if (rule.condition.urlFilter !== undefined && rule.condition.regexFilter !== undefined) {
      errors.push(prefix + '.condition: cannot have both urlFilter and regexFilter');
    }
    if (rule.condition.urlFilter !== undefined && (typeof rule.condition.urlFilter !== 'string' || rule.condition.urlFilter === '')) {
      errors.push(prefix + '.condition.urlFilter must be a non-empty string');
    }
    if (rule.condition.regexFilter !== undefined && (typeof rule.condition.regexFilter !== 'string' || rule.condition.regexFilter === '')) {
      errors.push(prefix + '.condition.regexFilter must be a non-empty string');
    }

    if (!Array.isArray(rule.condition.resourceTypes) || rule.condition.resourceTypes.length === 0) {
      errors.push(prefix + '.condition.resourceTypes must be a non-empty array');
    } else {
      const seenTypes = new Set();
      for (const rt of rule.condition.resourceTypes) {
        if (rt === 'main_frame') {
          errors.push(prefix + '.condition.resourceTypes: main_frame is rejected');
        } else if (!ALLOWED_REMOTE_RESOURCE_TYPES.includes(rt)) {
          errors.push(prefix + '.condition.resourceTypes: "' + rt + '" is not allowed');
        }
        if (seenTypes.has(rt)) {
          errors.push(prefix + '.condition.resourceTypes: duplicate "' + rt + '"');
        }
        seenTypes.add(rt);
      }
    }
  }

  return errors;
}

function validateRemoteDnrRuleset(rules, descriptor) {
  const errors = [];

  if (rules.length !== descriptor.rule_count) {
    errors.push('Rule count ' + rules.length + ' does not match descriptor (' + descriptor.rule_count + ')');
  }

  const seenIds = new Set();
  for (let i = 0; i < rules.length; i++) {
    const ruleErrors = validateRemoteDnrRule(rules[i], i);
    errors.push(...ruleErrors);

    if (Number.isInteger(rules[i].id)) {
      if (seenIds.has(rules[i].id)) {
        errors.push('rule[' + i + ']: duplicate id ' + rules[i].id);
      }
      seenIds.add(rules[i].id);
    }
  }

  return errors;
}

function validateRulesetTextAgainstDescriptor(text, descriptor) {
  const descriptorErrors = validateRulesetFileDescriptor(descriptor);
  if (descriptorErrors.length > 0) {
    return { ok: false, errors: descriptorErrors };
  }

  const parseResult = parseRulesetText(text);
  if (!parseResult.ok) {
    return { ok: false, errors: parseResult.errors };
  }

  const errors = validateRemoteDnrRuleset(parseResult.rules, descriptor);
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, rules: parseResult.rules };
}

// --- Update Validation Pipeline (local only — no fetch, no application) ---

async function validateUpdatePackageLocally({ manifest, filesByPath, currentRulesetVersion }) {
  const shapeErrors = validateUpdateManifestShape(manifest);
  if (shapeErrors.length > 0) {
    return { ok: false, stage: 'manifest_shape', errors: shapeErrors };
  }

  if (!isMonotonicRulesetVersion(currentRulesetVersion, manifest.ruleset_version)) {
    return {
      ok: false,
      stage: 'version_check',
      errors: ['Ruleset version ' + manifest.ruleset_version + ' is not greater than current ' + currentRulesetVersion]
    };
  }

  const sigResult = await verifyManifestSignature(manifest);
  if (!sigResult.ok) {
    return { ok: false, stage: 'signature', errors: [sigResult.error] };
  }

  const validatedFiles = [];
  for (const descriptor of manifest.files) {
    if (!filesByPath || typeof filesByPath !== 'object' || !(descriptor.path in filesByPath)) {
      return {
        ok: false,
        stage: 'file_missing',
        errors: ['Missing file for path: ' + descriptor.path]
      };
    }

    const fileText = filesByPath[descriptor.path];
    if (typeof fileText !== 'string') {
      return {
        ok: false,
        stage: 'file_type',
        errors: ['File content for ' + descriptor.path + ' must be a string']
      };
    }
    const hashResult = await verifyTextSha256(fileText, descriptor.sha256);
    if (!hashResult.ok) {
      return {
        ok: false,
        stage: 'hash_verification',
        errors: [descriptor.path + ': ' + hashResult.error]
      };
    }

    const ruleResult = validateRulesetTextAgainstDescriptor(fileText, descriptor);
    if (!ruleResult.ok) {
      return {
        ok: false,
        stage: 'rule_validation',
        errors: ruleResult.errors.map((e) => descriptor.path + ': ' + e)
      };
    }

    validatedFiles.push({
      ruleset_id: descriptor.ruleset_id,
      path: descriptor.path,
      rule_count: descriptor.rule_count
    });
  }

  return {
    ok: true,
    ruleset_version: manifest.ruleset_version,
    validated_files: validatedFiles
  };
}

// --- Update State / Last-Known-Good / Rollback (local only — no fetch, no application) ---

function createDefaultUpdateState() {
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

function createDefaultLastKnownGoodRuleset() {
  return {
    ruleset_version: 1,
    source: 'static',
    activated_at: null,
    files: []
  };
}

function createDefaultRollbackState() {
  return {
    rollback_active: false,
    rollback_reason: null,
    rolled_back_at: null,
    previous_ruleset_version: null,
    restored_ruleset_version: null
  };
}

async function getUpdateState() {
  const { update_state } = await chrome.storage.local.get('update_state');
  return update_state || createDefaultUpdateState();
}

async function saveUpdateState(state) {
  await chrome.storage.local.set({ update_state: state });
}

async function getLastKnownGoodRuleset() {
  const { last_known_good_ruleset } = await chrome.storage.local.get('last_known_good_ruleset');
  return last_known_good_ruleset || createDefaultLastKnownGoodRuleset();
}

async function saveLastKnownGoodRuleset(state) {
  await chrome.storage.local.set({ last_known_good_ruleset: state });
}

async function getRollbackState() {
  const { rollback_state } = await chrome.storage.local.get('rollback_state');
  return rollback_state || createDefaultRollbackState();
}

async function saveRollbackState(state) {
  await chrome.storage.local.set({ rollback_state: state });
}

async function recordUpdateValidationFailure(stage, errors) {
  const state = await getUpdateState();
  state.consecutive_failures += 1;
  state.last_failure_at = new Date().toISOString();
  state.last_failure_stage = stage;
  state.last_failure_errors = errors;
  state.last_check_at = new Date().toISOString();
  await saveUpdateState(state);
  return state;
}

async function recordUpdateValidationSuccess(result) {
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

async function activateRollback(reason) {
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

async function clearRollbackState() {
  await saveRollbackState(createDefaultRollbackState());

  const stats = await getStats();
  stats.rollback_active = false;
  stats.rollback_reason = null;
  await saveStats(stats);
}

// --- Dynamic Rule Application (local only — no fetch, no remote endpoints) ---

function collectValidatedRulesFromPackage(manifest, filesByPath) {
  const allRules = [];
  const errors = [];
  for (const descriptor of manifest.files) {
    const text = filesByPath[descriptor.path];
    const parseResult = parseRulesetText(text);
    if (!parseResult.ok) {
      errors.push(descriptor.path + ': ' + parseResult.errors.join(', '));
      continue;
    }
    for (const rule of parseResult.rules) {
      if (!Number.isInteger(rule.id) || rule.id < REMOTE_DYNAMIC_RULE_ID_START || rule.id > REMOTE_DYNAMIC_RULE_ID_MAX) {
        errors.push(descriptor.path + ': rule id ' + rule.id + ' outside range ' + REMOTE_DYNAMIC_RULE_ID_START + '–' + REMOTE_DYNAMIC_RULE_ID_MAX);
        continue;
      }
      allRules.push(rule);
    }
  }
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, rules: allRules };
}

async function getRemoteDynamicRuleIds() {
  const dynamicRules = await chrome.declarativeNetRequest.getDynamicRules();
  return dynamicRules
    .filter((r) => r.id >= REMOTE_DYNAMIC_RULE_ID_START && r.id <= REMOTE_DYNAMIC_RULE_ID_MAX)
    .map((r) => r.id);
}

async function clearRemoteDynamicRules() {
  const removeIds = await getRemoteDynamicRuleIds();
  if (removeIds.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: removeIds,
      addRules: []
    });
  }
}

async function applyValidatedDynamicRules(validatedPackage, manifest, filesByPath) {
  const collected = collectValidatedRulesFromPackage(manifest, filesByPath);
  if (!collected.ok) {
    return { ok: false, stage: 'rule_collection', errors: collected.errors };
  }

  const existingRemoteIds = await getRemoteDynamicRuleIds();

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: existingRemoteIds,
      addRules: collected.rules
    });
  } catch (e) {
    const errorMsg = 'updateDynamicRules failed: ' + e.message;
    await recordUpdateValidationFailure('apply_dynamic_rules', [errorMsg]);
    await activateRollback('dynamic_rule_application_failed');
    return { ok: false, stage: 'apply_dynamic_rules', errors: [errorMsg] };
  }

  await saveLastKnownGoodRuleset({
    ruleset_version: manifest.ruleset_version,
    source: 'signed_update',
    activated_at: new Date().toISOString(),
    files: validatedPackage.validated_files
  });

  await recordUpdateValidationSuccess(validatedPackage);
  await clearRollbackState();

  return {
    ok: true,
    applied_rule_count: collected.rules.length,
    ruleset_version: manifest.ruleset_version
  };
}

async function applyValidatedUpdatePackageLocally({ manifest, filesByPath, currentRulesetVersion }) {
  const validationResult = await validateUpdatePackageLocally({ manifest, filesByPath, currentRulesetVersion });
  if (!validationResult.ok) {
    await recordUpdateValidationFailure(validationResult.stage, validationResult.errors);
    return validationResult;
  }

  return applyValidatedDynamicRules(validationResult, manifest, filesByPath);
}

// --- Allowlist Engine ---

const ALLOWLIST_RULE_ID_START = 50000;
const ALLOWLIST_RULE_ID_MAX = 59999;

function parseDomain(input) {
  if (typeof input !== 'string') return null;
  let d = input.trim().toLowerCase();
  if (!d) return null;

  d = d.replace(/^https?:\/\//, '');
  d = d.replace(/\/.*$/, '');
  d = d.replace(/[?#].*$/, '');
  d = d.replace(/:\d+$/, '');
  d = d.replace(/\.$/, '');

  if (!d) return null;
  if (/^[*.\s]+$/.test(d)) return null;
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(d)) return null;

  return d;
}

async function getAllowlist() {
  const { user_allowlist } = await chrome.storage.local.get('user_allowlist');
  return user_allowlist || [];
}

async function saveAllowlist(list) {
  await chrome.storage.local.set({ user_allowlist: list });
}

function allowlistRuleId(index) {
  return ALLOWLIST_RULE_ID_START + index;
}

async function syncAllowlistDNR(list) {
  const enabledDomains = list.filter((e) => e.enabled);

  const removeIds = [];
  for (let i = 0; i <= ALLOWLIST_RULE_ID_MAX - ALLOWLIST_RULE_ID_START; i++) {
    removeIds.push(ALLOWLIST_RULE_ID_START + i);
  }

  const addRules = enabledDomains.map((entry, i) => ({
    id: allowlistRuleId(i),
    priority: 2,
    action: { type: 'allow' },
    condition: {
      initiatorDomains: [entry.domain],
      resourceTypes: ['script', 'image', 'xmlhttprequest', 'sub_frame', 'stylesheet', 'font', 'media']
    }
  }));

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: removeIds,
    addRules
  });
}

async function addAllowlistDomain(rawDomain) {
  const domain = parseDomain(rawDomain);
  if (!domain) return { error: 'Invalid domain' };

  const list = await getAllowlist();
  if (list.some((e) => e.domain === domain)) {
    return { error: 'Domain already allowlisted' };
  }

  if (list.length >= (ALLOWLIST_RULE_ID_MAX - ALLOWLIST_RULE_ID_START + 1)) {
    return { error: 'Allowlist full' };
  }

  list.push({
    domain,
    created_at: new Date().toISOString(),
    source: 'manual',
    enabled: true
  });

  await saveAllowlist(list);
  await syncAllowlistDNR(list);
  return { ok: true, list };
}

async function removeAllowlistDomain(domain) {
  let list = await getAllowlist();
  const before = list.length;
  list = list.filter((e) => e.domain !== domain);
  if (list.length === before) {
    return { error: 'Domain not found' };
  }
  await saveAllowlist(list);
  await syncAllowlistDNR(list);
  return { ok: true, list };
}

// --- Storage Init ---

async function initializeStorage() {
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
