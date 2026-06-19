# CleanBlock Permission Model

## Current permissions (v0.1)

| Permission | Feature | Why required |
|------------|---------|-------------|
| `storage` | Settings, user allowlist, last-known-good state, update metadata | Core data persistence |
| `declarativeNetRequest` | Network-level ad/tracker blocking via static and dynamic rulesets | Core blocking engine |
| `alarms` | Scheduled filter update checks | Automatic signed-update polling |

## Not requested

| Permission | Why excluded |
|------------|-------------|
| `host_permissions` | DNR static/dynamic rulesets do not require host access for block/allow/upgradeScheme actions |
| `tabs` | No tab inspection needed; allowlist is manual domain entry |
| `activeTab` | No current-page interaction |
| `scripting` | No content script injection in v0.1 (reserved for v0.2 CSS cosmetic filtering) |
| `webRequest` | Replaced by `declarativeNetRequest` in MV3 |
| `cookies` | Near-disqualifying for a privacy blocker |
| `management` | Extension inventory is privacy-sensitive |
| `offscreen` | Not needed for pure blocking |
| `declarativeNetRequestFeedback` | Would enable per-request match counting but expands privacy surface |
| `declarativeNetRequestWithHostAccess` | Not needed for current rule types |
| `history` | No browsing history access |
| `bookmarks` | No bookmark access |
| `topSites` | No top-sites access |
| `geolocation` | No location access |

## v0.2 planned changes

`scripting` will be added for `chrome.scripting.insertCSS()` cosmetic element hiding. CSS injection only — no JavaScript content script execution. `host_permissions` may be required for CSS injection and will be evaluated and documented at v0.2 scope.

## Verification

Run `npm run verify:manifest` to confirm:

- Permissions are exactly `[storage, declarativeNetRequest, alarms]`
- No forbidden permissions are present
- No `host_permissions` key exists
- No `content_scripts` key exists
