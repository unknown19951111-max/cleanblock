# CleanBlock Static Rules — v0.1 Notes

Intentionally small rulesets for smoke testing. Not imported from EasyList or any third-party filter list.

## ID Ranges

| Ruleset | ID range | Count |
|---------|----------|-------|
| core-ads | 1–10 | 10 |
| privacy-trackers | 1001–1010 | 10 |
| annoyances | 2001–2005 | 5 |

ID ranges are non-overlapping so rules can coexist without conflict across rulesets.

## core-ads.json (IDs 1–10)

Well-known ad-serving domains. Each is a major ad network with public documentation.

| ID | Domain | Operator |
|----|--------|----------|
| 1 | doubleclick.net | Google |
| 2 | googlesyndication.com | Google (AdSense) |
| 3 | googleadservices.com | Google (Ads click tracking) |
| 4 | adnxs.com | Microsoft/Xandr (AppNexus) |
| 5 | ads-twitter.com | X/Twitter |
| 6 | moatads.com | Oracle (Moat) |
| 7 | amazon-adsystem.com | Amazon |
| 8 | rubiconproject.com | Magnite (Rubicon) |
| 9 | openx.net | OpenX |
| 10 | pubmatic.com | PubMatic |

Resource types: `script`, `image`, `xmlhttprequest`, `sub_frame`.

## privacy-trackers.json (IDs 1001–1010)

Analytics and session-replay services that track user behavior across sites.

| ID | Domain / Path | Operator |
|----|---------------|----------|
| 1001 | google-analytics.com | Google |
| 1002 | googletagmanager.com | Google |
| 1003 | facebook.net/en_US/fbevents.js | Meta (Pixel) |
| 1004 | hotjar.com | Hotjar (session replay) |
| 1005 | segment.io | Twilio Segment |
| 1006 | mixpanel.com | Mixpanel |
| 1007 | amplitude.com/api | Amplitude |
| 1008 | clarity.ms | Microsoft Clarity |
| 1009 | scorecardresearch.com | comScore |
| 1010 | quantserve.com | Quantcast |

Resource types vary per domain — script-only where the domain serves only JS, broader where it also beacons via images/XHR.

Rule 1003 (Meta Pixel) uses a path filter instead of domain-level block to avoid breaking Facebook social widgets. Only the tracking pixel script is blocked.

Rule 1007 (Amplitude) targets the `/api` path to avoid blocking Amplitude's marketing site if a user visits it directly.

## annoyances.json (IDs 2001–2005)

Cookie consent managers that inject banners. Blocking the script prevents the banner from rendering.

| ID | Domain | Operator |
|----|--------|----------|
| 2001 | cookiebot.com | Usercentrics |
| 2002 | cookielaw.org | OneTrust |
| 2003 | consent.cookiebot.com | Usercentrics (consent API) |
| 2004 | trustarc.com | TrustArc |
| 2005 | onetrust.com | OneTrust |

Resource types: `script` only (plus `xmlhttprequest` for 2003's consent API). These domains serve consent-management scripts, not page content.

## Design Decisions

- **Block action only.** No `allow`, `redirect`, `modifyHeaders`, or `upgradeScheme` in v0.1.
- **No `main_frame` resource type.** Blocking main_frame navigations would break site loading entirely.
- **Priority 1 across all rules.** No priority conflicts to debug during smoke testing.
- **Domain-level filters.** Using `||domain^` pattern for broad coverage. Path-level filters used only where domain-level would cause breakage (Meta Pixel, Amplitude API).
