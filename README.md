# CleanBlock

Privacy-preserving content blocker for Chrome, built on Manifest V3.

**Status: v0.1.0 proof-of-concept.** 25 static rules across 3 rulesets. Not a production ad blocker — a working prototype that demonstrates a verifiable trust model.

<p align="center">
<svg viewBox="0 0 700 340" xmlns="http://www.w3.org/2000/svg" role="img">
  <title>CleanBlock Architecture</title>
  <desc>How web requests flow through CleanBlock's DNR filter inside Chrome's sandbox</desc>
  <style>
    text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, sans-serif; }
  </style>
  <defs>
    <marker id="a" markerWidth="7" markerHeight="5" refX="7" refY="2.5" orient="auto">
      <path d="M0,0 L7,2.5 L0,5" fill="#94a3b8"/>
    </marker>
  </defs>

  <!-- Title -->
  <text x="28" y="26" font-size="16" font-weight="800" fill="#1e293b">CleanBlock</text>
  <text x="28" y="42" font-size="11" fill="#94a3b8">v0.1.0 proof-of-concept · 25 DNR rules · no telemetry</text>

  <!-- Sandbox boundary -->
  <rect x="28" y="62" width="644" height="196" rx="10" fill="none" stroke="#e2e8f0" stroke-width="1.5" stroke-dasharray="5 4"/>
  <rect x="52" y="54" width="124" height="16" rx="2" fill="#ffffff"/>
  <text x="58" y="65" font-size="8.5" font-weight="800" letter-spacing="1.2" fill="#94a3b8">CHROME SANDBOX</text>

  <!-- Left: incoming requests -->
  <text x="68" y="160" font-size="12" font-weight="600" fill="#64748b" text-anchor="middle">Web</text>
  <text x="68" y="175" font-size="12" font-weight="600" fill="#64748b" text-anchor="middle">requests</text>

  <!-- Arrow 1 -->
  <line x1="104" y1="164" x2="178" y2="164" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#a)"/>

  <!-- DNR Filter box -->
  <rect x="188" y="98" width="194" height="132" rx="8" fill="#f8fafc" stroke="#2563eb" stroke-width="1.5"/>
  <text x="285" y="120" text-anchor="middle" font-size="9" font-weight="800" letter-spacing="1" fill="#2563eb">DECLARATIVENETREQUEST</text>
  <line x1="204" y1="130" x2="366" y2="130" stroke="#e2e8f0" stroke-width="0.75"/>
  <text x="210" y="152" font-size="12" fill="#1e293b">Core Ads</text>
  <text x="370" y="152" text-anchor="end" font-size="11" font-weight="700" font-family="ui-monospace, monospace" fill="#94a3b8">10</text>
  <text x="210" y="173" font-size="12" fill="#1e293b">Privacy Trackers</text>
  <text x="370" y="173" text-anchor="end" font-size="11" font-weight="700" font-family="ui-monospace, monospace" fill="#94a3b8">10</text>
  <text x="210" y="194" font-size="12" fill="#1e293b">Annoyances</text>
  <text x="370" y="194" text-anchor="end" font-size="11" font-weight="700" font-family="ui-monospace, monospace" fill="#94a3b8">5</text>
  <line x1="204" y1="204" x2="366" y2="204" stroke="#e2e8f0" stroke-width="0.75"/>
  <text x="285" y="222" text-anchor="middle" font-size="10" font-weight="600" fill="#94a3b8">25 rules</text>

  <!-- Arrow 2 -->
  <line x1="382" y1="164" x2="462" y2="164" stroke="#94a3b8" stroke-width="1.5" marker-end="url(#a)"/>

  <!-- Right: page -->
  <text x="478" y="138" font-size="14" font-weight="700" fill="#1e293b">Your page</text>
  <text x="478" y="158" font-size="11" fill="#64748b">CleanBlock never sees</text>
  <text x="478" y="173" font-size="11" fill="#64748b">page content, DOM,</text>
  <text x="478" y="188" font-size="11" fill="#64748b">cookies, or network.</text>
  <text x="478" y="210" font-size="10" font-weight="700" fill="#b91c1c">0 outbound requests</text>

  <!-- Bottom left: trust gate -->
  <text x="28" y="290" font-size="8.5" font-weight="800" letter-spacing="1" fill="#94a3b8">UPDATE TRUST GATE</text>
  <text x="28" y="308" font-size="11" fill="#64748b">shape → version → signature → hash → rule check</text>
  <text x="28" y="324" font-size="9.5" font-style="italic" fill="#94a3b8">scaffold only — not live</text>

  <!-- Bottom right: verify -->
  <text x="672" y="308" text-anchor="end" font-size="11.5" font-weight="700" font-family="ui-monospace, monospace" fill="#64748b">npm run verify</text>
  <text x="672" y="324" text-anchor="end" font-size="10" fill="#94a3b8">manifest · rulesets · privacy · trust</text>
</svg>
</p>

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
