# R04 invitation containment candidate

Prepared on `reconcile/invitation-safety` by the reconciliation agent from main `3ecfa4c8b8e369264bc680d25cabf1948c542913`. Fresh fetch and PR #3 metadata/comments review found Users still an active owned draft at `932fd32659afe621dbc405d52aa279fa23bf1913`, with no discussion transferring ownership. Its native/provider/store work stays in that track. No shared branch was edited or merged.

## Scope and behavior

The older main portal imported and loaded the unfinished invitation service at startup, exposed preview/list/create/manage/accept routes, and offered elevated invitation controls. This candidate disconnects that module and its store, removes invitation controls/handlers, and returns generic 404 for invitation paths behind the existing private gateway for members, inviters, administrators and callers without an identity. Unsupported methods return 405. Other authenticated POST requests return 405. Gateway and membership/linked-account launcher checks remain in place.

There is no enable flag, delivery registration, state reader, migration, token creation or native provisioning callback. `PC_INVITATIONS_PATH`, `PC_INVITATION_DELIVERY` and an attempted enable variable cannot activate these paths. Existing state/audit/account files are never opened by invitation code. Historical `invitation-service.cjs`, its unit tests, installers and pinned manifests remain retained unchanged and unregistered. Their historical positive tests do not certify safe future onboarding. No automatic cleanup or upgrade is introduced.

The R03 evidence artifact remains immutable on draft PR #7. This main-based source change is a narrowly reviewable containment delta; its older standalone desktop cannot replace the observed Chat/Files/Photos/Cinema window release. Later current-window integration must preserve the nine-source provenance, scoped native destinations and frame state. No installer, release packet, deployment approval or runtime rollback is included. Do not use retained historical helpers against either candidate or live release.

## Verification and acceptance limits

- Fourteen backend cases pass against a copied server/public tree with the invitation module deliberately absent. The fixture supplies an unknown-format preexisting store and attempted activation variables; startup succeeds and concurrent requests preserve the store and directory contents byte-for-byte.
- Negative HTTP matrices cover list/inspect/create/revoke/resend/retry/accept, foreign principals, admin/inviter roles, elevated role/quota/application requests, absent/null/wrong-scheme/wrong-port/cross-site/valid Origin and Fetch Metadata, unusual methods/encoded aliases, no native-state advancement, no token/preview leakage and private source/store/config paths. Every invitation operation is unavailable; these are containment proofs.
- Two unchanged historical service unit cases also run in `npm test`. They do not cover the confirmed legacy security gaps, and the legacy module must remain disconnected.
- Isolated Chrome checks pass for synthetic identity/account display, linked Files/Photos launch destinations with no opener, search, mobile layout, escaped names, and absent admin/inviter invitation controls with API denial. Every nonlocal request is fulfilled synthetically. No native gateway/login, application, Plex, inference, provider or user-data request is made.
- Initial Windows test teardown attempted fixture removal before child exit and failed EPERM. Awaiting owned child exit before bounded cleanup fixed it; the subsequent suite passes. No runtime failure is inferred.

Run `npm run check` and `npm test` in this directory. Optional browser check: make the prototype-lock-pinned Playwright Core 1.65.0 available through a process-local `NODE_PATH`, then run `node browser-qa.cjs` with installed Windows Chrome. Dependencies/screenshots stay ignored. No npm installation changes are part of this candidate.

## Remaining gates

R04's containment slice does not complete enabled invitation policy/token/store acceptance. R07 still owns cross-inviter authorization with enabled operations, least-privilege role/quota policy, exact-origin/Fetch Metadata enforcement, hash-only token rotation/retention/single use, native email/session binding, proof/receipt issuance, worker/provider reconciliation and truthful suspend/removal state. Windows denial tests cannot establish Linux UID/modes/locks/fsync/restart/crash durability, private directory mounting or safe old-store migration. Never silently rewrite a possibly token-bearing legacy store.

Next independent step is R05 current Chat-window source reconciliation after a fresh ownership/activity review, preserving the R03 observed window behavior and this containment intent. No bulk merge/copy of PR #3/#5/#6/#7 or this recent candidate. Native per-user Plex/owner-token removal remains R08, and all deployment preparation requires fresh exact source/Compose/before/after/backup identities and separately approved operator execution. No main integration, privileged command, identity/proxy/network/configuration change or deployment occurred.
