# CleanBlock Allowlist Policy

## Statement

CleanBlock's only allowlist is the user's own per-domain exception list, stored locally in `chrome.storage.local`. There are no company-controlled, revenue-linked, or affiliate exceptions.

## How the allowlist works

1. User enters a domain in the popup UI
2. Domain is validated (must be a valid hostname, no protocol, no path)
3. A DNR `allow` rule is created with `initiatorDomains` scoped to that domain
4. Rule IDs are allocated in the 50000–59999 range
5. The rule is applied via `chrome.declarativeNetRequest.updateDynamicRules()`
6. The domain list is persisted in `chrome.storage.local`

## What the allowlist does not do

- Does not inspect the current active tab to suggest domains
- Does not require `tabs`, `activeTab`, or `host_permissions`
- Does not phone home to verify domain status
- Does not maintain a remote allowlist
- Does not accept programmatic additions from external sources

## Governance

- User allow always wins over default block (except future malware/phishing rules if added)
- User block always wins over default allow
- No Acceptable Ads program
- No fair-ads exceptions
- No partner or affiliate exceptions
- No revenue-linked exceptions

## Verification

Run `npm run verify:privacy` and inspect `schemas/allowlist.json` to confirm no business exceptions exist.
