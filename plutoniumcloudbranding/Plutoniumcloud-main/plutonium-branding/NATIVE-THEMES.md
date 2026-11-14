# M3 native app appearance — inventory first

Current accepted portal source is plutonium-files-window, with shared native Files/Photos windows and user-reported successful test-file upload/download plus simultaneous Photos use. Branding here refers to the native apps inside their windows; parent CSS does not theme cross-origin child documents.

## Observed without login

- Immich v3.3.6 /api/server/version and public config responded over trusted HTTPS. Public config does not include custom CSS and cannot establish whether CSS exists.
- The old /api/server/theme returned404; Immich v3 migration replaced it with GET /custom.css. Confirmed /custom.css HTTP200 text/css, zero bytes, SHA256 e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855. No current CSS to overwrite at observation time; recheck before any write.
- Actual public stylesheet /_app/immutable/assets/0.DS5pOn4G.css SHA25663e575e1447a2ba142844c97f2e85619aa5f1deba5132eeaaf0883d37b389454 exposes --immich-bg/fg/primary/gray, dark variants and --immich-ui-* palette variables. Use installed selectors/values, not assumptions from another major version. All semantic warning/danger/success states and native controls must remain readable and functional.
- Nextcloud native theming supports branding, but latest online manuals describe later versions; installed CLI/current values are required before choosing exact keys or asset rollback. Do not install another CSS app or modify native bundles as a shortcut.

## Current user command

```bash
sudo python3 /home/adrian/homelab-portal/inspect-native-themes.py
```

Expected: READ-ONLY NATIVE THEME INVENTORY COMPLETE. Checks accepted portal hashes, required app health, native Files integration enablement, Nextcloud theming app/config allowlist and installed command help; Immich version/custom.css hash and whether a file configuration override exists. No credential values or raw environment/settings dumped. Native occ reads may initialize routine caches/logging but no app enablement, source deployment or explicit settings/service changes occur. No rollback needed.

Helper SHA256: 1ddfd16b27735e1a49bc31cee8cf4a4175edc1490382da87e440dd999215d7db

## Preparation after output

1. Choose supported native Nextcloud name/link/slogan/colors/assets from actual installed interface, retaining user preferences and legal/privacy settings unless explicitly in scope. Capture only owned before-values and image assets if any image changes are proposed.
2. Prepare Immich custom CSS from shared Plutonium tokens, narrowly based on observed installed variables/components. Preserve error and warning colors, focus/disabled/loading states, actions, photo/video surfaces and reduced motion. Avoid network imports, hidden controls, broad element resets or DOM rewrites. No system-config migration to a new file.
3. Preview public login in browser memory without submitting credentials, test fixtures/dark-light layouts and source safety. Actual logged-in photo/files views still need user visual/functional acceptance. Do not claim an initial-login screenshot proves the signed-in experience.
4. Produce exact proposed settings, install commands, expected output, protected backups and scoped rollback. Ask approval before appearance settings change. Split app deployments/acceptance if their rollback mechanisms differ.

Sources: https://docs.nextcloud.com/server/latest/admin_manual/configuration_server/theming.html ; https://docs.immich.app/administration/system-settings/ ; https://immich.app/blog/v3-migration . Version-specific installed observations take precedence over newer documentation.
