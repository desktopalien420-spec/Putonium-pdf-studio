# M3 native appearance pass 1 — reviewable deployment packet

## CURRENT RECOVERY — approved update partially applied

User diagnosis proved name and URL equal planned values, while config:list masks URL. Slogan and both colors remain absent. Original helper wrongly compared that URL mask; no actual newer appearance edit was found. Corrected read uses list only for presence and key-specific config:app:get ONLY for five owned non-secret appearance fields, not --private/all-config output.

The root state phase is prepared and ORIGINAL before-values remain protected. Do not delete/reset state or repeat install. Resume is within the user's existing go nextcloud theme approval and writes only remaining approved fields after verifying saved target, partial phase, each current value in before/after, native versions, source and HTTPS. Original helper is retained as apply-nextcloud-theme.before-getter-fix.py.

Next user command:

```bash
sudo python3 /home/adrian/homelab-portal/apply-nextcloud-theme.py resume
```

Expected NEXTCLOUD NATIVE THEME READY. Saves the final phase only after exact persisted values/HTTPS checks. Newer edits and accepted/rolled-back phases are refused. Existing protected before-state is never replaced on resume. Rollback remains the same helper rollback and now reads actual owned values rather than a redacted list.

Eleven isolated getter/rollback/resume tests passed, including URL masking, no unrelated getters, getter failure propagation, exactly three remaining writes, original backup preservation, conflicting/concurrent edits, phase refusal and restore-before-health. Native resume is still pending user execution. No new live appearance writes during correction.

Inventory passed on installed Nextcloud34.0.5/theming2.9.0 and Immich3.3.6. Nextcloud has only theming metadata keys (no custom appearance values); theming_customcss is not enabled. Immich has no configuration-file override and custom.css is empty. Files native integration0.1.0 and accepted portal hashes were verified, both apps/portal healthy. Full user-pasted Files preflight/install output also confirmed native scope tests and successful private deployment.

## Phase A — Nextcloud text and neutral colors

Only five native instance defaults:

| Setting | Proposed value |
|---|---|
| name | Plutonium Cloud |
| url | https://plutoniumcloud.com |
| slogan | Your files. Your space. |
| primary_color | #b8b8b8 |
| background_color | #0a0a0a |

Supported occ theming:config performs normal cache invalidation. Existing native layout, logos, legal/privacy settings, user color/background/light/dark preferences and Files framing integration are preserved. User-specific colors can override instance defaults; do not disable user theming just to force a screenshot. No new CSS plugin, image upload, core edits, restart, proxy/network/SSH change, account or file ownership change. This is a branding foundation, not the eventual full bespoke app interface.

### Optional read-only packet check

```bash
sudo python3 /home/adrian/homelab-portal/apply-nextcloud-theme.py check
```

Expected READ-ONLY NEXTCLOUD THEME PREFLIGHT PASSED. Verifies the reviewed helper, exact portal source, installed versions/native CLI choices, owned defaults still unconfigured, and existing trusted HTTPS. No appearance setting writes or restarts. Ordinary occ reads may initialize routine cache/log records. No rollback needed. The previously completed inventory already checked the relevant installed interface; install repeats this packet preflight.

### Apply only after go nextcloud theme approval

```bash
sudo python3 /home/adrian/homelab-portal/apply-nextcloud-theme.py install
```

Expected NEXTCLOUD NATIVE THEME READY. First records exact presence/value of the five keys in protected root-only /var/lib/homelab-nextcloud-theme/state.json. Then applies one key at a time, checking for concurrent edits and exact persistence. Only those five appearance defaults are owned. Normal native cache counters may advance. No service restart required; reload Files/standalone tab to see changes.

Risk: cache delays, unsupported runtime behavior or low contrast in a native view could require restoring defaults. **No SSH lockout steps**: SSH/network/firewall untouched. Keep SSH and current recovery administrator session open. Do not change other theme values during apply/rollback.

### Acceptance

Reload Files. Confirm instance name and neutral accents where instance defaults are active; existing files and Files/Photos windows still work. Check buttons/focus/selection/disabled/error states and ordinary/recovery native sign-in. Actual Nextcloud rendering has not been previewed using its modified server defaults; native engine may adjust colors for contrast. If a personal theme overrides defaults, leave it unless the user explicitly chooses a personal change.

### Scoped rollback

```bash
sudo python3 /home/adrian/homelab-portal/apply-nextcloud-theme.py rollback
```

Expected NEXTCLOUD THEME ROLLED BACK. Uses the native command reset for keys previously absent and restores prior exact values otherwise. Verifies exact owned before-state. Restores appearance before checking unrelated HTTPS health, records appearance_restored_verification_pending if the latter fails. It refuses newer conflicting appearance values. No whole theming-config restore, default-all action, logo/data deletion or restart. Retain root state; do not repeat install if a record exists.

## Phase B — Immich CSS, separately approved after Nextcloud acceptance

Candidate immich-plutonium-v1.css changes primary accent palettes (light/dark), legacy primary variables and font stack only. No fonts fetched; existing fonts/system fallback used. Native logos/layout, image/video behavior and semantic danger/warning/success/info palettes remain. No display/visibility/pointer-event suppression, network imports, broad layout reset or image filters. iPhone native app appearance is outside this website CSS.

Before changing CSS:

```bash
python3 /home/adrian/homelab-portal/check-immich-theme.py before
```

Expected IMMICH THEME BASELINE VERIFIED. If CSS is no longer empty, stop and preserve that customization. It is a trusted HTTPS read without credentials/settings mutation.

After explicit approval, open Photos separately and sign in with the existing LOCAL Recovery Administrator (not ordinary Adrian). Under Administration > Settings > Theme > Custom CSS, paste the exact candidate file and save only that section. Do not change OAuth/password/account settings. Keep the working ordinary session and SSH open. Credentials remain private; no API token or password required by the helper.

Verify delivery:

```bash
python3 /home/adrian/homelab-portal/check-immich-theme.py after
```

Expected IMMICH THEME DELIVERY VERIFIED. This verifies only CSS bytes served, allowing normal textarea newline normalization. Reload Photos; check login/SSO, existing library, album/photo viewer, upload/download/video, controls, dark/light and phone browser as available. Public-login preview does not prove these.

Immich rollback: in the same native Custom CSS field remove ONLY the candidate CSS and save that section (before-state was empty), then reload Photos and rerun before checker to confirm baseline. Do not reset the whole system configuration or switch to a config file. The candidate and explicit empty before-state are retained in this packet.

## Tests/evidence before staging

- Five actual Nextcloud rollback-function fixture tests: exact five-key ownership/absence restoration, partial install, newer conflicting values refused, tampered state refused, restoration before unrelated HTTPS failure. These do not prove the installed native reset implementation; exact persistence guards run during apply/rollback.
- Immich live PUBLIC login memory-only stylesheet substitution over trusted HTTPS: Chrome light/dark at1440x1000 and390x844, email/password controls visible, expected palette variables, no horizontal overflow/page errors. Screenshots inspected. No forms submitted, credentials used, settings saved or user library inspected. Actual Safari and signed-in timeline/media are still unverified.
- Native themes inventory completed and no existing custom values/CSS found. No native appearance writes have occurred yet.

## Source hashes

Nextcloud helper SHA256 66e8d2c384e9caff54ddf8530c348685e2edc4d3cf42828bf46cd5f1f58309bb
Immich delivery checker SHA256 532f49589e3d10329052975554217fdc3a474883971b4ede61047870471d8c58
Immich CSS SHA256 2fd9b3f5aad4ede26c4807cd2a039b2d3e707d5c63476bd3fa6fd963c76a7700

Primary references: https://docs.nextcloud.com/server/latest/admin_manual/configuration_server/theming.html ; https://raw.githubusercontent.com/nextcloud/server/v34.0.5/apps/theming/lib/ThemingDefaults.php ; https://docs.immich.app/administration/system-settings/ ; https://immich.app/blog/v3-migration . The installed CLI help is authoritative where newer manuals differ (this version does not advertise image keys in the theming CLI).
