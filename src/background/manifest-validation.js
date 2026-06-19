import {
  ALLOWED_RULE_TYPES, ALLOWED_MANIFEST_VERSION, KNOWN_RULESET_IDS,
  ALLOWED_UPDATE_MANIFEST_FIELDS, ALLOWED_UPDATE_FILE_DESCRIPTOR_FIELDS,
  ALLOWED_SIGNATURE_FIELDS
} from './constants.js';
import { validateObjectOnlyHasAllowedFields } from './validation-helpers.js';

export function isAllowedRuleType(ruleType) {
  return ALLOWED_RULE_TYPES.includes(ruleType);
}

export function isMonotonicRulesetVersion(currentVersion, nextVersion) {
  return Number.isInteger(nextVersion) && nextVersion > currentVersion;
}

export function validateRulesetFileDescriptor(file) {
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

export function validateUpdateManifestShape(manifest) {
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
