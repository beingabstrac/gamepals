# 14 — Store kit

What the stores need from us, where each piece comes from, and what is still missing. Listing words and the privacy page are M12b; this page is the pictures (M12a).

## Sizes, from the vendors' own pages (checked 2026-09-18)
| Where | What | Pixels | Our project |
|---|---|---|---|
| App Store | 6.9" iPhone | 1260 × 2736 | `store-iphone` (420 × 912 at 3x) |
| App Store | 13" iPad | 2064 × 2752 | `store-ipad` (1032 × 1376 at 2x) |
| Google Play | Phone | 1080 × 1920 | `store-play-phone` (360 × 640 at 3x) |
| Google Play | Tablet, landscape | 1920 × 1080 | `store-play-tablet` (960 × 540 at 2x) |
| Google Play | Feature graphic | 1024 × 500 | `store-feature` (1024 × 500 at 1x) |

- Apple scales one size down to every smaller one, so 6.9" iPhone and 13" iPad cover the whole list. Sources: [App Store screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/).
- **Google Play insists on exactly 16:9 or 9:16.** Apple's shapes are neither (1260 × 2736 is about 1:2.17), so Play cannot reuse them and gets its own pair. Source: [Play graphic asset requirements](https://support.google.com/googleplay/android-developer/answer/9866151).
- Every shot is a **JPEG**. Both stores refuse an alpha channel, and a JPEG cannot carry one.
- The app icon (512 × 512) comes from `apps/client/scripts/make-icons.mjs`, not from here.

## Taking them
GitHub → Actions → CI → Run workflow, tick **store**. The `store` job plays the games and uploads a `store-screenshots` artifact holding a folder per size, plus `feature-graphic.jpg`.

Locally: `pnpm e2e --project store-iphone --grep @store` (and the same for the other four).

## What each shot says
1. **The shelf** — every game in one app. The claim the whole listing rests on.
2. **The table** — chairs, who is in them, and the four bot levels. This is where "any way to play" is proved.
3. **Chess**, 4. **Ludo**, 5. **Air Hockey**, 6. **Solitaire** — one from each family: board, race, real-time, cards.

The gameplay shots are taken with bots in every seat, so the board is a real game rather than an empty one. That means the turn line reads as a bot's name rather than "You". If we want "You" in the picture, that is a change to how the shot is taken, not to the app.

## Do not upload the tablet shots yet
Taking these was the first time anyone looked at the app at tablet size, and it shows: on a 13" iPad the board fills the width and leaves the bottom third empty, and on a landscape tablet it sits in the middle third with empty space either side. The phone shots are fine. M12c is the layout work; retake the tablet shots after it.

## Still missing
- **Caption overlays.** These are clean screenshots of the real app, which the stores accept. Most apps add a line of text over each. That is a design pass, not a test pass, and it is not done.
- **`app-ads.txt`** waits on an AdMob publisher ID (M10). The file is a public promise about who may sell our inventory, so a placeholder is worse than nothing.
- **Localised shots.** English only for now.
