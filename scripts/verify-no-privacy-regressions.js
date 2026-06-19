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

function grepFile(filePath, pattern) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const matches = [];
  lines.forEach((line, i) => {
    if (pattern.test(line)) {
      matches.push({ line: i + 1, text: line.trim() });
    }
  });
  return matches;
}

function grepFileExcluding(filePath, pattern, excludePattern) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const matches = [];
  lines.forEach((line, i) => {
    if (pattern.test(line) && !excludePattern.test(line)) {
      matches.push({ line: i + 1, text: line.trim() });
    }
  });
  return matches;
}

console.log('--- verify-no-privacy-regressions ---');

const swPath = path.join(ROOT, 'src/background/service-worker.js');
const popupJsPath = path.join(ROOT, 'src/popup.js');
const popupHtmlPath = path.join(ROOT, 'src/popup.html');

const sourceFiles = [
  { path: swPath, label: 'service-worker.js' },
  { path: popupJsPath, label: 'popup.js' }
];

sourceFiles.forEach(({ path: fp, label }) => {
  const fetchMatches = grepFileExcluding(fp, /\bfetch\b/, /\/\//);
  check(label + ': no fetch()', fetchMatches.length === 0,
    fetchMatches.map((m) => 'line ' + m.line + ': ' + m.text).join('; '));

  const xhrMatches = grepFile(fp, /XMLHttpRequest/);
  check(label + ': no XMLHttpRequest', xhrMatches.length === 0);

  const axiosMatches = grepFile(fp, /\baxios\b/);
  check(label + ': no axios', axiosMatches.length === 0);

  const remoteUrlMatches = grepFileExcluding(fp, /https?:\/\//, /\/\//);
  check(label + ': no hardcoded remote URLs', remoteUrlMatches.length === 0,
    remoteUrlMatches.map((m) => 'line ' + m.line + ': ' + m.text).join('; '));
});

const evalMatches = grepFileExcluding(swPath, /\beval\s*\(|new\s+Function\s*\(|\bimportScripts\s*\(/, /REJECTED_EXECUTABLE_FIELDS|'eval'|'function'/);
check('service-worker.js: no eval/new Function/importScripts (excluding rejected-field strings)',
  evalMatches.length === 0,
  evalMatches.map((m) => 'line ' + m.line + ': ' + m.text).join('; '));

const devHandlerMatches = grepFile(swPath, /message\.type\s*===\s*'DEV_/);
check('service-worker.js: no DEV_ runtime message handlers',
  devHandlerMatches.length === 0,
  devHandlerMatches.map((m) => 'line ' + m.line + ': ' + m.text).join('; '));

const forbiddenApis = [
  'chrome\\.tabs', 'chrome\\.cookies', 'chrome\\.history',
  'chrome\\.webRequest', 'chrome\\.management', 'chrome\\.scripting',
  'chrome\\.offscreen', 'chrome\\.bookmarks', 'chrome\\.topSites'
];
forbiddenApis.forEach((api) => {
  const re = new RegExp(api.replace(/\\/g, '\\'));
  sourceFiles.forEach(({ path: fp, label }) => {
    const matches = grepFile(fp, re);
    check(label + ': no ' + api.replace(/\\\./g, '.'), matches.length === 0,
      matches.map((m) => 'line ' + m.line).join(', '));
  });
});

const popupHtml = fs.readFileSync(popupHtmlPath, 'utf8');
const srcRefs = popupHtml.match(/(?:src|href)\s*=\s*"([^"]+)"/g) || [];
srcRefs.forEach((ref) => {
  const url = ref.match(/"([^"]+)"/)[1];
  check('popup.html ref "' + url + '" is local', !url.startsWith('http'));
});

const manifestPerms = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8')).permissions || [];
const privacySensitive = ['cookies', 'tabs', 'activeTab', 'history', 'webRequest', 'scripting', 'management'];
privacySensitive.forEach((p) => {
  check('manifest: no "' + p + '" permission', !manifestPerms.includes(p));
});

console.log('');
if (failures > 0) {
  console.log('RESULT: ' + failures + ' failure(s)');
  process.exit(1);
} else {
  console.log('RESULT: all checks passed');
}
