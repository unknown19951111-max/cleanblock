'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let failures = 0;

function check(label, ok, detail) {
  if (ok) {
    console.log('  PASS  ' + label);
  } else {
    console.log('  FAIL  ' + label + (detail ? ' — ' + detail : ''));
    failures++;
  }
}

console.log('--- verify-update-trust-surface ---');

const trustDocs = [
  'trust/TELEMETRY.md',
  'trust/ALLOWLIST.md',
  'trust/PERMISSIONS.md',
  'trust/SECURITY.md',
  'trust/BUILD_PROVENANCE.md'
];
trustDocs.forEach((doc) => {
  check(doc + ' exists', fs.existsSync(path.join(ROOT, doc)));
});

const schemaFiles = [
  'schemas/telemetry-schema.json',
  'schemas/allowlist.json',
  'schemas/permission-map.json',
  'schemas/remote-rule-schema.json',
  'schemas/store-claims.json'
];
schemaFiles.forEach((sf) => {
  const sfPath = path.join(ROOT, sf);
  check(sf + ' exists', fs.existsSync(sfPath));
  if (fs.existsSync(sfPath)) {
    try {
      JSON.parse(fs.readFileSync(sfPath, 'utf8'));
      check(sf + ' is valid JSON', true);
    } catch (e) {
      check(sf + ' is valid JSON', false, e.message);
    }
  }
});

check('docs/REMOTE_RULES.md exists',
  fs.existsSync(path.join(ROOT, 'docs/REMOTE_RULES.md')));

check('updates/README.md exists',
  fs.existsSync(path.join(ROOT, 'updates/README.md')));

const examplePath = path.join(ROOT, 'updates/update-manifest.example.json');
check('updates/update-manifest.example.json exists', fs.existsSync(examplePath));

let exampleManifest;
try {
  exampleManifest = JSON.parse(fs.readFileSync(examplePath, 'utf8'));
  check('update-manifest.example.json is valid JSON', true);
} catch (e) {
  check('update-manifest.example.json is valid JSON', false, e.message);
}

if (exampleManifest) {
  check('example has manifest_version', Number.isInteger(exampleManifest.manifest_version));
  check('example has ruleset_version', Number.isInteger(exampleManifest.ruleset_version));
  check('example has files array', Array.isArray(exampleManifest.files) && exampleManifest.files.length > 0);
  check('example has signature object', exampleManifest.signature && typeof exampleManifest.signature === 'object');
  check('example signature algorithm is Ed25519', exampleManifest.signature && exampleManifest.signature.algorithm === 'Ed25519');

  if (exampleManifest.files) {
    exampleManifest.files.forEach((f, i) => {
      check('example files[' + i + '] rule_type is dnr_dynamic_ruleset_update',
        f.rule_type === 'dnr_dynamic_ruleset_update');
    });
  }
}

const swSource = fs.readFileSync(path.join(ROOT, 'src/background/service-worker.js'), 'utf8');

const trustFunctions = [
  'validateUpdateManifestShape',
  'validateRulesetFileDescriptor',
  'validateRemoteDnrRule',
  'validateRemoteDnrRuleset',
  'verifyTextSha256',
  'verifyManifestSignature',
  'canonicalizeManifestForSigning',
  'validateUpdatePackageLocally',
  'applyValidatedUpdatePackageLocally',
  'collectValidatedRulesFromPackage',
  'applyValidatedDynamicRules',
  'getRemoteDynamicRuleIds',
  'clearRemoteDynamicRules',
  'recordUpdateValidationFailure',
  'recordUpdateValidationSuccess',
  'activateRollback',
  'clearRollbackState',
  'getUpdateState',
  'saveUpdateState',
  'getLastKnownGoodRuleset',
  'saveLastKnownGoodRuleset',
  'getRollbackState',
  'saveRollbackState'
];

trustFunctions.forEach((fn) => {
  check('function ' + fn + '() exists', swSource.includes('function ' + fn + '('));
});

const popupJs = fs.readFileSync(path.join(ROOT, 'src/popup.js'), 'utf8');
check('popup.js renders trust state', popupJs.includes('renderTrustState'));

const popupHtml = fs.readFileSync(path.join(ROOT, 'src/popup.html'), 'utf8');
const trustIds = [
  'trust-version', 'trust-source', 'trust-last-success',
  'trust-last-failure', 'trust-failures', 'trust-rollback', 'trust-lkg'
];
trustIds.forEach((id) => {
  check('popup.html has element #' + id, popupHtml.includes('id="' + id + '"'));
});

check('popup.html has trust scaffold label',
  popupHtml.includes('Signed updates: local validation scaffold'));

console.log('');
if (failures > 0) {
  console.log('RESULT: ' + failures + ' failure(s)');
  process.exit(1);
} else {
  console.log('RESULT: all checks passed');
}
