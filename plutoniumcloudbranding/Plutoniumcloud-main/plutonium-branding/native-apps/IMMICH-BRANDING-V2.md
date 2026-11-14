# Plutonium Photos — visual web logo pass v2

Status: APPLIED AND CORE USER-ACCEPTED. User approved go photos branding, saved CSS, reported delivery verified and confirmed wide/compact header logos plus existing photo viewing. Current native Immich palette/font v1 is delivered and user-accepted including existing photos, readable controls, opening a photo and test upload. Local Recovery Administrator login now works; no password reset or role changes were needed.

## Intended result

Use the existing Plutonium orbit mark for native web logo images. Use a matching PLUTONIUM / PHOTOS wordmark for non-square native header logos; compact/mobile and login icon variants stay square. Both dark/light forms included. Current palette/font CSS v1 is retained verbatim. No restart, account change, template/core/container edit or proxy/DNS/firewall change.

This is a visual CSS adapter, not a native frontend fork. Browser tab title, favicon, metadata, native accessibility alternate image labels and iPhone app branding are unchanged. Signed-in header/layout must be confirmed by user; source-reviewed header fixtures are not an authenticated app test. Native updates/translations that change the alt label, class or component markup may need an adapter revision. No promise of full or upgrade-proof rebranding.

## Evidence

Installed public login DOM uses img alt=Immich logo; native Logo component has draggable=false and aspect-square for icon variants. Pinned Nextcloud-independent Immich3.3.6 NavigationBar source uses Logo inline or icon according to sidebar mode. Published @immich/ui0.90.0 source (dependency range ^0.90.0) confirms those attributes/classes and the separate logo manager. This is source compatibility evidence, not proof of the exact resolved UI package version in the running build. Actual public browser rendering also verified.

Candidate CSS precisely matches these native logo images. It uses four self-contained SVG data URLs (light/dark icon/wordmark), not a new HTTP asset service, dynamic scripts, DOM rewrites or external fonts. Only svg/g/circle/ellipse/text elements; no scripts/events/links. Native linked logo elements stay keyboard-focusable and keep their destinations. No unrelated controls or semantic statuses are hidden. Logo change also neutralizes the native decorative login-logo background through replacement of its logo image.

Chrome public-login browser-memory substitution passed dark/light at1440x1000 and390x844 with visible inputs, expected palette, no overflow/page errors and new logo content. Source-reviewed inline and compact header fixtures passed image replacement/sizing and keyboard focus in both themes; screenshot reviewed. Actual signed-in header, native mobile app and Safari not tested. No form submitted, settings saved or library accessed during preview.

## Approval and apply

Obtain go photos branding approval first. Keep Adrian portal profile and administrator browser separate. Existing Recovery Administrator must use local email/password, not Authentik akadmin OAuth application.

Check current palette-only baseline:

```bash
python3 /home/adrian/homelab-portal/check-immich-branding.py before
```

Expected IMMICH BRANDING BASELINE VERIFIED. If current CSS differs, stop/preserve newer edits. Check is read-only trusted HTTPS, no rollback needed.

After approval, in native Immich Administration > Settings > Theme > Custom CSS, replace field contents with exact immich-plutonium-v2.css and save only that section. This is the full accepted v1 palette plus logo adapter; do not append a second copy to an unknown stylesheet.

Verify:

```bash
python3 /home/adrian/homelab-portal/check-immich-branding.py after
```

Expected IMMICH BRANDING DELIVERY VERIFIED. Reload Photos in ordinary Adrian desktop; check wide header wordmark, narrow icon, library/photo viewing/upload and readable controls, plus local recovery login. Browser title/favicon/iPhone remain native by design for this pass. No SSH lockout step or service restart.

## Rollback

Replace ONLY native Custom CSS field with retained immich-plutonium-v1.css, save Theme, reload Photos and rerun the before checker. Expected IMMICH BRANDING BASELINE VERIFIED. Do not clear the field: that would also remove the already accepted palette. Preserve both candidate files and project checkpoints. If newer CSS has been added since this pass, preserve it and review before replacing. No global settings reset.

V1 CSS SHA256 2fd9b3f5aad4ede26c4807cd2a039b2d3e707d5c63476bd3fa6fd963c76a7700
V2 CSS SHA256 3c59b0aabdc20edc74ac32ad62e3dd837f1a8d9e8ab10dce74bdb06b6dadf5c3
Checker SHA256 d99112a9e6aa37f9cc9127d726ebb80df0c0221f8d816da176c46b21928c0f9a

Sources: https://docs.immich.app/administration/system-settings/ ; https://ui.immich.app/components/logo ; https://raw.githubusercontent.com/immich-app/immich/v3.3.6/web/src/lib/components/shared-components/navigation-bar/NavigationBar.svelte ; published package https://registry.npmjs.org/@immich/ui/0.90.0 (repository immich-app/static-pages, packages/ui).
