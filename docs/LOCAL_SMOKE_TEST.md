# CleanBlock Local Smoke Test

Manual verification checklist for loading CleanBlock in Chrome and confirming core functionality.

## Prerequisites

- Chrome 111+
- Node.js installed (for `npm run verify`)
- CleanBlock repo cloned locally

## Load Extension

1. Open `chrome://extensions`
2. Enable **Developer Mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `cleanblock/` project folder (the one containing `manifest.json`)
5. Confirm the extension loads without errors — no red error badge on the extension card

## Popup Dashboard

6. Click the CleanBlock extension icon in the toolbar to open the popup
7. Confirm **Blocked today** and **Blocked total** display as numbers (initially 0)
8. Confirm all three static rulesets show green dots and **Active** status:
   - Core Ads
   - Privacy Trackers
   - Annoyances

## Update Trust State Card

9. Confirm the **Update Trust State** card displays:
   - Ruleset version: `1`
   - Source: `static`
   - Last success: `—`
   - Last failure: `—`
   - Consecutive failures: `0`
   - Rollback: `Inactive`
   - Last-known-good: `v1 (static)`
   - Label: **Signed updates: local validation scaffold**

## Manual Allowlist

10. Type `example.com` in the allowlist input field and click **Allow**
11. Confirm `example.com` appears in the allowlist entries below the input
12. Click the **x** button next to `example.com`
13. Confirm the entry disappears from the list

## Stability

14. Close and re-open the popup — confirm it renders without blank screen or crash
15. Navigate to a few websites — confirm no console errors from the extension in `chrome://extensions` error log

## Verification Scripts

16. In a terminal, from the `cleanblock/` directory, run:
    ```
    npm run verify
    ```
17. Confirm all four verification scripts pass with zero failures

## Failure Means

| Symptom | Likely cause |
|---------|-------------|
| Extension fails to load | `manifest.json` syntax error, missing service worker file, or invalid `declarative_net_request` path |
| Red error badge on extension card | Service worker crash — check `chrome://extensions` error log for stack trace |
| Popup is blank | `popup.js` runtime error — right-click popup, Inspect, check console |
| Rulesets show Disabled | `ruleset_health` not initialized in storage — check `initializeStorage()` |
| Allowlist add fails silently | `declarativeNetRequest.updateDynamicRules` error — check service worker console |
| Allowlist add shows "Invalid domain" | Domain parsing rejected the input — check `parseDomain()` logic |
| Trust State card shows all dashes | `GET_HEALTH` response missing `update_state` or `rollback_state` — check service worker |
| `npm run verify` fails | Trust or privacy regression introduced — read the specific FAIL line for details |
