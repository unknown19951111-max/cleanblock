import { REMOTE_DYNAMIC_RULE_ID_START, REMOTE_DYNAMIC_RULE_ID_MAX } from './constants.js';
import { verifyTextSha256, verifyManifestSignature } from './crypto.js';
import { validateUpdateManifestShape, isMonotonicRulesetVersion } from './manifest-validation.js';
import { parseRulesetText, validateRulesetTextAgainstDescriptor } from './rule-validation.js';
import {
  recordUpdateValidationFailure, recordUpdateValidationSuccess,
  activateRollback, clearRollbackState, saveLastKnownGoodRuleset
} from './update-state.js';

export async function validateUpdatePackageLocally({ manifest, filesByPath, currentRulesetVersion }) {
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

export function collectValidatedRulesFromPackage(manifest, filesByPath) {
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

export async function getRemoteDynamicRuleIds() {
  const dynamicRules = await chrome.declarativeNetRequest.getDynamicRules();
  return dynamicRules
    .filter((r) => r.id >= REMOTE_DYNAMIC_RULE_ID_START && r.id <= REMOTE_DYNAMIC_RULE_ID_MAX)
    .map((r) => r.id);
}

export async function clearRemoteDynamicRules() {
  const removeIds = await getRemoteDynamicRuleIds();
  if (removeIds.length > 0) {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: removeIds,
      addRules: []
    });
  }
}

export async function applyValidatedDynamicRules(validatedPackage, manifest, filesByPath) {
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

export async function applyValidatedUpdatePackageLocally({ manifest, filesByPath, currentRulesetVersion }) {
  const validationResult = await validateUpdatePackageLocally({ manifest, filesByPath, currentRulesetVersion });
  if (!validationResult.ok) {
    await recordUpdateValidationFailure(validationResult.stage, validationResult.errors);
    return validationResult;
  }

  return applyValidatedDynamicRules(validationResult, manifest, filesByPath);
}
