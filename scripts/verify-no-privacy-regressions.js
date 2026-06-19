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

const popupJsPath = path.join(ROOT, 'src/popup.js');
const popupHtmlPath = path.join(ROOT, 'src/popup.html');
const bgDir = path.join(ROOT, 'src/background');

const bgFiles = fs.readdirSync(bgDir)
  .filter((f) => f.endsWith('.js'))
  .map((f) => ({ path: path.join(bgDir, f), label: f }));

const sourceFiles = bgFiles.concat([
  { path: popupJsPath, label: 'popup.js' }
]);

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

bgFiles.forEach(({ path: fp, label }) => {
  const evalMatches = grepFileExcluding(fp, /\beval\s*\(|new\s+Function\s*\(|\bimportScripts\s*\(/, /REJECTED_EXECUTABLE_FIELDS|'eval'|'function'/);
  check(label + ': no eval/new Function/importScripts (excluding rejected-field strings)',
    evalMatches.length === 0,
    evalMatches.map((m) => 'line ' + m.line + ': ' + m.text).join('; '));

  const devHandlerMatches = grepFile(fp, /message\.type\s*===\s*'DEV_/);
  check(label + ': no DEV_ runtime message handlers',
    devHandlerMatches.length === 0,
    devHandlerMatches.map((m) => 'line ' + m.line + ': ' + m.text).join('; '));
});

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

// --- Module boundary check ---

const manifestValSource = fs.readFileSync(path.join(ROOT, 'src/background/manifest-validation.js'), 'utf8');
check('manifest-validation.js does not import rule-validation.js',
  !manifestValSource.includes("from './rule-validation.js'"));

const swSource = fs.readFileSync(path.join(ROOT, 'src/background/service-worker.js'), 'utf8');
check('service-worker.js contains no validation logic',
  !swSource.includes('function validate'));

// --- Key material and packaging artifact scan ---

function walkDir(dir, exclude) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (exclude.includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(walkDir(full, exclude));
    } else {
      results.push(full);
    }
  }
  return results;
}

const allFiles = walkDir(ROOT, ['.git', 'node_modules']);
const keyExtensions = ['.pem', '.key', '.p8', '.p12', '.crt', '.cer', '.crx'];
const keyFilenames = ['key.json'];
const keyPrefixes = ['private-key', 'private_key', 'signing-key', 'signing_key'];

const keyMaterialFiles = allFiles.filter((f) => {
  const base = path.basename(f);
  const ext = path.extname(f).toLowerCase();
  if (keyExtensions.includes(ext)) return true;
  if (keyFilenames.includes(base)) return true;
  if (keyPrefixes.some((p) => base.startsWith(p))) return true;
  return false;
});

check('no key material or .crx files in repo',
  keyMaterialFiles.length === 0,
  keyMaterialFiles.map((f) => path.relative(ROOT, f)).join(', '));

const privateKeyHeaders = [
  'BEGIN' + ' PRIVATE KEY',
  'BEGIN' + ' RSA PRIVATE KEY',
  'BEGIN' + ' EC PRIVATE KEY',
  'BEGIN' + ' OPENSSH PRIVATE KEY'
];

const textExtensions = ['.js', '.json', '.md', '.txt', '.html', '.css', '.yaml', '.yml', '.toml'];
const textFiles = allFiles.filter((f) => textExtensions.includes(path.extname(f).toLowerCase()));
const filesWithKeys = [];

textFiles.forEach((f) => {
  const content = fs.readFileSync(f, 'utf8');
  for (const header of privateKeyHeaders) {
    if (content.includes(header)) {
      filesWithKeys.push(path.relative(ROOT, f) + ' contains "' + header + '"');
      break;
    }
  }
});

check('no private key headers in source files',
  filesWithKeys.length === 0,
  filesWithKeys.join('; '));

console.log('');
if (failures > 0) {
  console.log('RESULT: ' + failures + ' failure(s)');
  process.exit(1);
} else {
  console.log('RESULT: all checks passed');
}
