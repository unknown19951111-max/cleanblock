# CleanBlock

Privacy-preserving content blocker for Chrome, built on Manifest V3.

**Status: v0.1.0 proof-of-concept.** 25 static rules across 3 rulesets. Not a production ad blocker — a working prototype that demonstrates a verifiable trust model.

<!-- TODO: Add popup screenshot showing trust state card and active rulesets -->

## Load in Chrome

Requires **Chrome 111+**.

1. Clone this repo
2. Open `chrome://extensions`
3. Enable **Developer Mode** (top-right toggle)
4. Click **Load unpacked** and select the repo root (the folder containing `manifest.json`)
5. Confirm no error badge on the extension card

**Try it:** visit a page with ads (e.g. a news site), click the CleanBlock icon in the toolbar, and check the blocked counter. Coverage is minimal — see [Limitations](#limitations) below.

See [LOCAL_SMOKE_TEST.md](docs/LOCAL_SMOKE_TEST.md) for a full verification checklist.

## How It Works

CleanBlock uses Chrome's `declarativeNetRequest` API to block requests. No host permissions, no content scripts, no telemetry, no build step — the source in this repo is the exact code that runs in Chrome.

- **No host permissions.** DNR rulesets operate without access to page content.
- **No telemetry.** Nothing leaves the device. No analytics, no outbound requests.
- **No content scripts, no build step.** Raw source ships directly — a reviewer can read every line that executes.

Permissions: `storage`, `declarativeNetRequest`, `alarms` — nothing else.

## Trust Model

Signed updates can add, remove, or modify DNR block/allow/upgradeScheme rules. They cannot introduce JavaScript, content scripts, scriptlets, eval-like patterns, or any executable code.

Every trust claim is mechanically verifiable: `npm run verify`.

Trust documentation lives in [`trust/`](trust/) — covers telemetry, allowlist, permissions, security, and build provenance.

## Limitations

This is a v0.1.0 proof-of-concept. Be aware of:

- **25 rules total** across 3 rulesets (core ads, privacy trackers, annoyances). Production blockers ship 300k+. Most ads will not be blocked.
- **No cosmetic filtering.** Ad containers and placeholders remain visible even when the network request is blocked. Planned for v0.2 via `chrome.scripting.insertCSS()`.
- **Update pipeline is scaffold-only.** The signed update validation logic exists and is tested, but is not connected to a live endpoint. Rules only change when you pull the repo.
- **No dynamic rule management UI.** The allowlist is manual.

## Verification

```
npm run verify
```

Runs four scripts that check manifest compliance, ruleset validity, privacy invariants, and trust surface. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for details.

## License

MIT — see [LICENSE](LICENSE).
