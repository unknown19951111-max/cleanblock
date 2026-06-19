'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

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

console.log('--- verify-manifest ---');

const manifestPath = path.join(ROOT, 'manifest.json');
let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  check('manifest.json is valid JSON', true);
} catch (e) {
  check('manifest.json is valid JSON', false, e.message);
  process.exit(1);
}

check('manifest_version is 3', manifest.manifest_version === 3);

const REQUIRED_PERMISSIONS = ['storage', 'declarativeNetRequest', 'alarms'];
const perms = manifest.permissions || [];
check(
  'permissions exactly [storage, declarativeNetRequest, alarms]',
  perms.length === REQUIRED_PERMISSIONS.length &&
    REQUIRED_PERMISSIONS.every((p) => perms.includes(p))
);

const FORBIDDEN_PERMISSIONS = [
  'cookies', 'tabs', 'activeTab', 'scripting', 'webRequest',
  'management', 'offscreen', 'declarativeNetRequestFeedback',
  'history', 'bookmarks', 'topSites', 'geolocation'
];
FORBIDDEN_PERMISSIONS.forEach((p) => {
  check('no "' + p + '" permission', !perms.includes(p));
});

check('no host_permissions',
  !manifest.host_permissions || (Array.isArray(manifest.host_permissions) && manifest.host_permissions.length === 0));

check('no content_scripts', !manifest.content_scripts);
check('no externally_connectable', !manifest.externally_connectable);

const ruleResources = manifest.declarative_net_request && manifest.declarative_net_request.rule_resources;
check('declarative_net_request.rule_resources exists', Array.isArray(ruleResources) && ruleResources.length > 0);

if (ruleResources) {
  ruleResources.forEach((r) => {
    const rulePath = path.join(ROOT, r.path);
    check('ruleset file exists: ' + r.path, fs.existsSync(rulePath));
  });
}

const icons = manifest.icons || {};
Object.entries(icons).forEach(([size, iconPath]) => {
  check('icon file exists: ' + iconPath, fs.existsSync(path.join(ROOT, iconPath)));
});

check('service_worker path set', !!(manifest.background && manifest.background.service_worker));

const swPath = path.join(ROOT, manifest.background.service_worker);
check('service_worker file exists', fs.existsSync(swPath));

try {
  execSync('node --check ' + JSON.stringify(swPath), { stdio: 'pipe' });
  check('service-worker.js syntax valid', true);
} catch (e) {
  check('service-worker.js syntax valid', false, e.stderr.toString().trim());
}

const popupJsPath = path.join(ROOT, 'src', 'popup.js');
try {
  execSync('node --check ' + JSON.stringify(popupJsPath), { stdio: 'pipe' });
  check('popup.js syntax valid', true);
} catch (e) {
  check('popup.js syntax valid', false, e.stderr.toString().trim());
}

console.log('');
if (failures > 0) {
  console.log('RESULT: ' + failures + ' failure(s)');
  process.exit(1);
} else {
  console.log('RESULT: all checks passed');
}
