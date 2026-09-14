# Licenses log

Every third-party asset, font, sound, word list and code dependency with a license other than MIT/BSD/Apache-2.0/ISC/CC0 must be listed here before it ships. No GPL/AGPL in shipped apps.

| Item | Source | License | Used in | Added |
|---|---|---|---|---|
| Phaser | npm `phaser` | MIT | client | 2026-09-12 |
| Preact | npm `preact` | MIT | client | 2026-09-12 |
| Capacitor core, CLI, Android, iOS | npm `@capacitor/*` | MIT | native apps | 2026-09-14 |
| Capacitor App, Preferences, Haptics | npm `@capacitor/app`, `@capacitor/preferences`, `@capacitor/haptics` | MIT | native apps | 2026-09-14 |
| vite-plugin-pwa (with Workbox) | npm `vite-plugin-pwa`, `workbox-*` | MIT | web build (installable, offline) | 2026-09-14 |
| App icons and favicon | Our own mascot, drawn by `apps/client/scripts/make-icons.mjs` | Ours | web and apps | 2026-09-14 |

## To verify before use
- `chess.js` (rules) — confirm license is permissive.
- `tonnetto` (TS chess engine, reference only) — confirm license.
- Kenney packs — CC0; record each pack when downloaded.
