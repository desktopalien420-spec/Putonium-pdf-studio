# Plutonium Cloud portal

### Integration record — 2026-11-11 (source only; not deployed)

The following dated records are retained verbatim. Main’s invitation containment remains authoritative; Cinema stays denied and onboarding remains owned by PR #3. Historical next steps are not new authorization.

#### Main history

R04 source-only containment candidate: invitation routes, module loading/store access and UI are disconnected. Read [INVITATION-CONTAINMENT.md](INVITATION-CONTAINMENT.md) before the historical installation notes below. This older main-based portal must not replace the observed custom window release. No deployment or provider activation is included.


#### R05 history

R05 source-only current-window candidate: Files/Photos/Chat window source is reconciled, invitations remain disconnected, and Cinema launch/status is gated pending native per-user assignment. `deployable=false`; read [SOURCE-RECONCILIATION.md](SOURCE-RECONCILIATION.md) before historical installation notes below. No live behavior was replaced or deployed.

Authenticated-backend source, separate from the approved local design prototype. Uses Node built-ins without runtime npm dependencies, authentik single-application forward auth, and a protected proxy-to-backend key.

Read [DEPLOYMENT-PLAN.md](DEPLOYMENT-PLAN.md) before installation. The backend is not a standalone internet service: it must remain behind the configured gateway. Fake identity headers are accepted only by the local QA harness with its private test key; there is no test-user mode in production code.

`npm run check` and `npm test` verify syntax and backend boundaries. `node browser-qa.cjs` uses prototype-lock-pinned Playwright Core available through process-local `NODE_PATH` and the installed Chrome browser; it never logs into the real identity service.

Adrian’s existing Nextcloud files and Immich photos are now linked through native SSO with separate recovery administrators. Subject-scoped Files/Photos launchers are user-confirmed working. Embedded windows, cross-app themes, browser VMs, chat and public ingress are future milestones. Read [the current start guide](../START-HERE.md), [current state](../PROJECT-STATE.md), and [development plan](../DEVELOPMENT-PLAN.md). Do not rerun the legacy portal installer against the updated launcher source.
