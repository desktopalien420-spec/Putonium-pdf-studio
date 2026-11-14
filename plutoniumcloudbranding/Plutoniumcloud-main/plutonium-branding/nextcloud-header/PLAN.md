# Plutonium / Files native header — preparation

User explicitly requested replacing the Nextcloud logo in the desktop Files window with matching PLUTONIUM / FILES and the shared orbit mark. Matching light/dark wordmark and compact icon assets prepared in assets/. No live image, theme, portal, app or framing changes yet.

## Finding

Nextcloud34.0.5 pinned core/css/header.scss defines a fixed62px-wide .logo with native home-link padding86px. Native Advanced Theming supports a Navigation bar logo (logoheader). Simply uploading a long wordmark to that fixed slot makes its text too small. A narrow native CSS layout adapter is needed for a readable wide wordmark and compact icon on small viewports. Do not solve this with a portal overlay, global CSP stripping, container/core edits, cross-origin DOM scraping or arbitrary frontend scripts.

Proposed implementation after inventory: a separate small local Files-header style app using public BeforeTemplateRenderedEvent and Util::addStyle, separate from existing plutonium_desktop_frame framing app. Scoped to ordinary Adrian's signed-in Files pages, consistent with current desktop pilot. Native logo/home-link behavior remains; CSS and assets only. Native recovery and unrelated apps are outside the proposed style scope. Consider native logoheader setting only if useful; preserve any existing custom asset first. Do not enable any app until an exact reviewed plan/check/rollback is prepared and approved.

## Next user step — read-only

```bash
sudo python3 /home/adrian/homelab-portal/inspect-nextcloud-header.py
```

Expected READ-ONLY FILES HEADER INVENTORY COMPLETE. Checks accepted portal source, native window/theming version and proposed style app collision, status, only boolean custom logo MIME flags, selected public header/event/styling source hashes/lines and current HTTPS. Source inventory does not bootstrap PHP. Standard occ reads may initialize routine caches/logging; no explicit settings/source/service changes. No rollback needed.

Helper SHA256 121c8cb260d83b07e4079b59d107a6a2d16fea97d19b977ff5badab40ef41b41

Actual installed hooks/custom logo status remain pending this output. No new installer exists yet. After inspection prepare guarded source/app enablement and rollback, meaningful PHP scope and browser-layout tests, and a concrete approval packet. Existing theme defaults and native frame policy must remain intact. Full native browser title/favicon/client branding remains outside this header-only request.

References: https://docs.nextcloud.com/server/stable/admin_manual/configuration_server/theming.html ; pinned https://raw.githubusercontent.com/nextcloud/server/v34.0.5/core/css/header.scss ; https://raw.githubusercontent.com/nextcloud/server/v34.0.5/apps/theming/src/components/AdminSectionThemingAdvanced.vue . This installed version's CLI previously advertised text/color keys only, so do not use newer CLI image commands without checking native support.


## Latest status

Installed inventory passed, including actual hooks/source hashes and absent custom logos. Production omits Vue admin source; this adapter does not need it. Separate native app/payload/guarded rollback is now prepared; read DEPLOYMENT-PLAN.md. User native deployment preflight and approval still pending. No live changes.
