# CleanBlock Build Provenance

## Current build process

CleanBlock has no build step. The extension ships raw source files directly:

- No bundler (no webpack, rollup, esbuild, parcel, or vite)
- No transpiler (no Babel, no TypeScript compilation)
- No minifier
- No source maps (not needed — source is shipped as-is)
- No generated files

## What this means for verification

The files in the repository are the exact files that run in Chrome. There is no build artifact to reverse-engineer or trust independently. A reviewer can:

1. Clone the repository
2. Load the `cleanblock/` directory as an unpacked extension in Chrome
3. Read every line of code that executes

## Verification scripts

Four verification scripts run against the raw source:

| Script | What it checks |
|--------|---------------|
| `verify-manifest.js` | MV3, exact permissions, forbidden permissions, icon/ruleset/service-worker file existence |
| `verify-rulesets.js` | Valid JSON, unique IDs, correct ID ranges, block-only actions, no main_frame blocking |
| `verify-no-privacy-regressions.js` | No fetch/XHR, no remote URLs, no eval, no forbidden Chrome APIs, no key material |
| `verify-update-trust-surface.js` | Trust docs, example manifest, trust functions, popup trust UI elements |

## Future considerations

If a build step is introduced (e.g., for TypeScript or ES module bundling), this document must be updated to describe:

- Exact build command and toolchain version
- How to reproduce the build deterministically
- How to verify the built output matches the source
