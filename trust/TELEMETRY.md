# CleanBlock Telemetry Policy

## Statement

CleanBlock sends no telemetry, analytics, crash reports, or usage data to any server. No data leaves the device.

## What is stored locally

- Ruleset version and source (`chrome.storage.local`)
- Update check timestamps and failure counters (`chrome.storage.local`)
- Rollback state (`chrome.storage.local`)
- User allowlist domains (`chrome.storage.local`)

## What is never stored

- URLs visited
- Domains visited
- Page titles
- Video IDs or channel IDs
- Search queries
- Cookie values
- Browsing timeline
- Per-site blocking history
- Installed extension inventory

## What is never transmitted

- No outbound HTTP/HTTPS requests from extension code
- No fetch, XMLHttpRequest, or WebSocket connections
- No third-party analytics SDKs (Segment, Google Analytics, Mixpanel, Amplitude)
- No crash reporting services (Sentry, Bugsnag)
- No user identifiers of any kind

## Verification

Run `npm run verify:privacy` to confirm:

- No `fetch()` or `XMLHttpRequest` calls in source
- No hardcoded remote URLs in source
- No third-party analytics imports
- No outbound data payloads

This claim is mechanically verifiable by reading the source code. There is no server component.
