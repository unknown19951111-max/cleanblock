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

console.log('--- verify-rulesets ---');

const STATIC_FILES = [
  { file: 'rules/static/core-ads.json', idRange: [1, 999] },
  { file: 'rules/static/privacy-trackers.json', idRange: [1000, 1999] },
  { file: 'rules/static/annoyances.json', idRange: [2000, 2999] }
];

const allStaticIds = new Set();

STATIC_FILES.forEach(({ file, idRange }) => {
  const filePath = path.join(ROOT, file);
  let rules;
  try {
    rules = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    check(file + ' is valid JSON', true);
  } catch (e) {
    check(file + ' is valid JSON', false, e.message);
    return;
  }

  check(file + ' is an array', Array.isArray(rules));
  check(file + ' has at least 1 rule', rules.length > 0);

  const ids = new Set();
  rules.forEach((rule, i) => {
    const prefix = file + ' rule[' + i + ']';
    check(prefix + ' has integer id', Number.isInteger(rule.id));
    check(
      prefix + ' id ' + rule.id + ' in range ' + idRange[0] + '–' + idRange[1],
      rule.id >= idRange[0] && rule.id <= idRange[1]
    );
    if (ids.has(rule.id)) {
      check(prefix + ' id ' + rule.id + ' is unique within file', false, 'duplicate');
    } else {
      ids.add(rule.id);
    }
    if (allStaticIds.has(rule.id)) {
      check(prefix + ' id ' + rule.id + ' is globally unique', false, 'duplicate across files');
    }
    allStaticIds.add(rule.id);

    check(prefix + ' has action.type "block"', rule.action && rule.action.type === 'block');
    check(prefix + ' has condition object', rule.condition && typeof rule.condition === 'object');
    if (rule.condition && rule.condition.resourceTypes) {
      check(
        prefix + ' does not block main_frame',
        !rule.condition.resourceTypes.includes('main_frame')
      );
    }
  });
});

const constantsSource = fs.readFileSync(path.join(ROOT, 'src/background/constants.js'), 'utf8');

const allowlistStart = constantsSource.match(/ALLOWLIST_RULE_ID_START\s*=\s*(\d+)/);
const allowlistMax = constantsSource.match(/ALLOWLIST_RULE_ID_MAX\s*=\s*(\d+)/);
check('allowlist ID range starts at 50000', allowlistStart && allowlistStart[1] === '50000');
check('allowlist ID range ends at 59999', allowlistMax && allowlistMax[1] === '59999');

const remoteStart = constantsSource.match(/REMOTE_DYNAMIC_RULE_ID_START\s*=\s*(\d+)/);
const remoteMax = constantsSource.match(/REMOTE_DYNAMIC_RULE_ID_MAX\s*=\s*(\d+)/);
check('remote dynamic ID range starts at 60000', remoteStart && remoteStart[1] === '60000');
check('remote dynamic ID range ends at 89999', remoteMax && remoteMax[1] === '89999');

check(
  'no ID range overlap: static < allowlist < remote',
  allStaticIds.size > 0 &&
    Math.max(...allStaticIds) < 50000
);

console.log('');
if (failures > 0) {
  console.log('RESULT: ' + failures + ' failure(s)');
  process.exit(1);
} else {
  console.log('RESULT: all checks passed');
}
