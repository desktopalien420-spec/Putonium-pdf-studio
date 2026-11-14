# Users and invitations — implementation and integration audit

### Integration record — 2026-11-11 (source only; not deployed)

The following dated records are retained verbatim. Main’s invitation containment remains authoritative; Cinema stays denied and onboarding remains owned by PR #3. Historical next steps are not new authorization.

#### Main history

R04 current source status: historical invitation module/routes/UI below are disconnected and unregistered. No store is loaded or migrated; invitation requests cannot enroll an identity. See [INVITATION-CONTAINMENT.md](INVITATION-CONTAINMENT.md). The retained audit below predates confirmed ownership/role/origin/token/store defects and must not be used as proof of safety or as deployment instructions. Active PR #3 retains separate native/provider/store gates.


#### R05 history

R05 current source: historical invitation module/routes/UI below are disconnected and unregistered. No invitation store is loaded or migrated. See [SOURCE-RECONCILIATION.md](SOURCE-RECONCILIATION.md). The historical audit below predates confirmed ownership/role/origin/token/store defects and must not serve as safety proof or deployment instructions. Active PR #3 retains enabled native/provider/store work.

Status: local implementation only. No production Authentik, mail, or application configuration was changed.

## Current integration matrix

| Boundary | Evidence in this repository | Status | Onboarding consequence |
| --- | --- | --- | --- |
| Portal identity | The portal requires the private gateway bridge key and `X-Authentik-*` identity headers; membership is checked server-side. | Implemented in portal; live gateway behavior unverified here | The portal never accepts a browser-supplied identity. |
| Authentik enrollment/MFA | `plutonium-portal-prototype/IDENTITY-PHASE-PLAN.md` describes a separate Authentik stack and enrollment setup, but does not expose a verified enrollment API or flow ID. | Planned / requires external configuration | Authentik remains the owner of password and MFA. The portal records lifecycle states but does not implement password/TOTP. |
| Nextcloud | Existing launcher uses a fixed OIDC login destination and linked account config. No provisioning API client or quota endpoint exists in this source. | Configured/linked for existing account; provisioning unverified | Future adapter must use Nextcloud admin/OCC/API credentials server-side and preserve manual quota increases. |
| Immich | Existing launcher uses an OIDC login destination. `IMMICH-PLAN.md` describes the deployment but not a verified per-user provisioning/quota API. | Configured/linked for existing account; provisioning unverified | Future adapter must verify the deployed Immich version and supported admin API before enabling automatic creation. |
| Plex | Portal can read server status with a server-side token; repository plans describe Plex library sharing. | Status read implemented; user invitation provisioning requires Plex-side configuration/API verification | Keep Plex invites/server tokens server-side; do not treat Plex as an OIDC account. |
| LibreChat / Chat | Repository checkpoint says Chat is separately deployed and model policy work is active; no user-provisioning contract is present in this portal. | Unverified / design-only | Gate access by portal assignment and verify the Chat deployment's OIDC or user model before provisioning. |
| Mail | No mail provider or delivery secret is present. | Mock delivery only | The response exposes a local preview URL only when mock delivery is explicitly in use. |

## Implemented lifecycle

`pending → identity_created → mfa_required → mfa_complete → provisioning → partially_provisioned/failed → ready` is represented by the invitation store. Revoked and suspended states are terminal from the invitation UI. The current local implementation creates and reconciles invitation records; it intentionally does not assert that external identity or app provisioning succeeded.

Invitation tokens are 256-bit random values. Only a SHA-256 token hash is stored. Records include inviter, role, assigned application set, quota profile, timestamps, expiry, accepted/revoked state, provisioning slots, and audit events. The file store is optional and disabled by default; when configured with `PC_INVITATIONS_PATH`, writes use a same-directory temporary file and mode `0600` before rename.

## Security and deployment boundaries

- `POST` invitation actions require an authenticated administrator or `plutonium-inviters` group and same-origin `Origin` when a browser sends one.
- Secrets and application credentials are never returned by `/api/me`, invitation responses, or browser code.
- Invitation creation/resend/acceptance should be rate-limited at the existing gateway before production enablement; this local service does not pretend to provide distributed rate limiting.
- Real email delivery, Authentik flow IDs, app API credentials, durable database storage, background provisioning jobs, and production CSRF/session binding remain external configuration work.
- Ordinary `plutonium-inviters` may not create administrator invitations; the API enforces that only the Authentik administrator group can assign the administrator role.

## Exact next deployment step

Before enabling this in a live portal, configure a reviewed durable store and mock-only preview on LAN, then verify the actual Authentik enrollment flow and MFA completion callback with one disposable test identity. Only after that should server-side adapters be added one application at a time.
