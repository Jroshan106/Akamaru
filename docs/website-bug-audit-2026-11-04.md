# Website playback bug audit — 2026-11-04

## Reported failure

Steel Ball Run: JoJo's Bizarre Adventure, MAL 61469, episode 1 could not
resolve Anikoto after the catalog lookup failed. Abyss had no player, so both
branches failed and no iframe could mount.

## Bugs fixed

| Finding | Change | Verification |
| --- | --- | --- |
| Playback title resolution depended entirely on Tenrai even when other verified metadata was available. | Fall back to AniZip title aliases only when its returned MAL mapping matches the requested ID. Cache successful aliases for five minutes and deduplicate concurrent lookups. Do not cache failures. | Simulated catalog 429 with real AniZip and Anikoto returned HTTP 200 for the correct first-stage title and episode 1's megaplay.buzz player. Regression tests reject mismatched IDs and distinguish 2nd Stage. |
| Retry player refreshed the episode/player endpoints but reused cached title lookup and search results. | Forward refresh=1 through the title resolver, metadata cache and search cache. | Tests replace a provider slug under the same title and confirm retry finds the updated result. |
| The sidebar preferred seven metadata episodes even when Anikoto supplied a one-episode listing. | Prefer the selected Anikoto provider's actual episode listing. Abyss retains metadata episodes; listings cannot leak between titles. | Live Anikoto returned one available episode. Regression checks verify one Anikoto episode versus seven metadata episodes and title isolation. |

## Test cycle

- After the initial resolver correction: **63 passed, 1 failed** out of 64.
- The failing redirect test assumed a single metadata request. It now checks
  both fixed metadata hosts, with redirects still rejected and never followed
  to the untrusted redirect target.
- Added refresh and sidebar regressions, fixed those paths, then reran every
  website test: **66 passed, 0 failed, 0 skipped**.
- Both client and server TypeScript checks passed.
- The production frontend build and Cloudflare deployment dry run passed.

Command used for the complete test run:

```text
node --test --test-concurrency=1 tests/*.test.mjs
```

## Scope of verification

Live verification requested public listings and the provider-returned episode
iframe URL. It did not establish successful video decoding inside the external
player, which remains controlled by that provider. No substitute stream or
unverified title match was introduced. Native Android and Windows apps were
outside this website change.

These results describe the workspace build. Publishing requires an authenticated
Cloudflare deployment; local success alone does not establish a live-site fix.
