# Plutonium / Files — native header style app

## Outcome and exact scope

In Adrian's signed-in Files pages, show the shared orbit mark with PLUTONIUM / FILES at widths above700px; show compact orbit at700px and below. Wordmark uses176x44px native header region and200px home-link inset; compact uses48px region/72px inset. SVG masks use native --color-header-primary or inherited text color for contrast. This replaces the visual header image, preserves the existing link destination/focus/menu behavior, and avoids squeezing a long wordmark into native62px slot.

A separate local app plutonium_files_brand v0.1.0 uses public BeforeTemplateRenderedEvent and Util::addStyle. Its listener permits only native UID admin (ordinary Adrian), logged-in session, conservative /apps/files paths, and the correct template event. Existing plutonium_desktop_frame remains unchanged. Recovery akadmin, other users, login/OIDC/settings/DAV and unrelated apps keep original styles. Multi-user styling expansion is future onboarding scope. Native titles/favicon/other pages do not change.

Exactly six new app files: metadata, Application registration, listener, CSS, wordmark SVG, compact SVG. No JavaScript, controllers, API keys, role/account writes, global theme setting changes or native logo uploads. No core/container bundle edits, proxy/framing/portal changes, restarts, DNS/firewall/SSH or drive changes. CSS uses only the native header home-link and .logo selectors. No controls hidden, pointer suppression or semantic palette overrides. Local app is unsigned/tracked source, pinned to Nextcloud34; revalidate on upgrades.

## Verified inventory and assumptions

User inventory COMPLETE: current accepted Files/Photos portal hashes; Nextcloud34.0.5/theming2.9.0/framing0.1.0; no custom logo/logoheader/favicon configured; proposed app ID/path free and persistent custom_apps writable; actual public event/Util/registration/header source present/hashes recorded. Production omits the Vue admin source file, which is not needed by this adapter.

Native install preflight must still verify pinned server image, named code volume, exact source hashes, daily/recovery privileges, source payload, PHP syntax and16 actual listener fixture scope cases in installed PHP. If anything changed, stop/preserve newer customization instead of weakening guards. Native event dispatch/header in a real signed-in browser remains a later acceptance step.

## Phase1 — read-only deployment preflight

```bash
sudo python3 /home/adrian/homelab-portal/deploy-nextcloud-header.py check
```

Expected READ-ONLY FILES HEADER PREFLIGHT PASSED. Reads installed status/source/selected known appearance fields and accounts' privilege flags, lints PHP through stdin, runs the isolated16-case scope fixture using native PHP without app bootstrap, and verifies existing trusted HTTPS. No app directory is created, app enabled, appearance setting changed or service restarted. Standard occ reads may initialize routine caches/logging; an ephemeral root deployment lock is acquired. No rollback required for check.

## Phase2 — install after go files branding approval

Keep existing SSH and administrator browser sessions open. **No SSH lockout step:** access/network/firewall are untouched. Main risk is native style/app compatibility or header crowding; standalone Files and existing frame integration stay available.

```bash
sudo python3 /home/adrian/homelab-portal/deploy-nextcloud-header.py install
```

Expected PLUTONIUM FILES HEADER READY. Repeats all prerequisites; saves root-only state/selected existing appearance snapshot under /var/lib/homelab-nextcloud-files-header/state.json; creates only new app folder in existing nextcloud_aio_nextcloud volume; verifies six hashes and enables only this app. It verifies native app enablement, unchanged theme values/framing version/portal source, CSS/SVG hashes delivered over trusted HTTPS and existing service health. Actual styles are not injected through proxy or portal overlay. No restarts.

Appearance snapshot uses only known-key getters to avoid Nextcloud config:list URL redaction and is never printed. No unrelated credentials/configuration are copied. Original native app/header source untouched. Auto-failure disables only the new app and retains reviewed source/state. Do not repeat install or remove state after failure.

## Phase3 — live browser acceptance one step at a time

1. Reload Files in the ordinary Adrian desktop (full iframe Reload to request a new native document). Widen above700px or maximize: expected orbit + PLUTONIUM / FILES; narrow to700px or below: compact orbit. A default680px-wide Files window intentionally shows compact icon.
2. Confirm native header home-link and app/menu/account/search buttons still work, keyboard focus visible, and no overlap/clipping at available widths. Back navigation may enter a different native app where this Files-only style is not loaded; return via desktop Files launcher if needed.
3. Existing Files list/open/upload/download and simultaneous Photos work. Check different native personal header colors if already used; do not disable personal theming to force a result.
4. Recovery admin native sign-in/administration remains available. Actual Safari/Mac/phone and extended document/media/session behavior are not proven by fixture tests. Do not broaden CSS/permissions as a shortcut.

## Scoped rollback

```bash
sudo python3 /home/adrian/homelab-portal/deploy-nextcloud-header.py rollback
```

Expected FILES HEADER ROLLED BACK. Verifies protected app/payload record and current app version/source, disables only plutonium_files_brand, saves disabled_verification_pending BEFORE unrelated health checks, verifies disablement then service health. Reload Files to drop its CSS. All six source files and root state are retained disabled; no directory or data deletion. Existing framing app, theme settings, Photos branding and portal remain untouched. Newer source/version or mismatched state causes guarded refusal. An unrelated health failure after disable leaves explicit pending state. Never run older Files/Nextcloud-theme/Photos rollback for this header-only issue.

## Tests already passed

- Six actual deployment-function tests: only header app disabled (framing/theme retained), source/version/state conflict refusals, disable-before-health failure behavior, exact seven-file archive/six native files.
- Header browser fixture:28 Chrome combinations (1440/800/701/700/680/390/320px x light/dark x LTR/RTL), expected wide/compact masks, native tint, no overlap/overflow, home-link focus/destination, all actions and unrelated logos retained. Screenshots viewed. Fixture is source-reviewed layout evidence, NOT real authenticated Nextcloud testing.
- Python/Node syntax, XML metadata and self-contained SVG element/reference checks passed. Native PHP checks still pending user-run preflight; do not claim these passed from local tests.

Helper SHA256 02ed63f29877c2d668684ee959e90500f3cebb7bd86b98efb61e6b0d70dab478
Payload SHA256 7f87487d06f841cc92e48b0db7da42d03f3165f6c7879b5dde81f4c7d25eb9d7

References: native API/style hashes from user inventory; https://raw.githubusercontent.com/nextcloud/server/v34.0.5/core/css/header.scss ; https://docs.nextcloud.com/server/latest/developer_manual/app_development/bootstrap.html ; public BeforeTemplateRenderedEvent/Util APIs.
