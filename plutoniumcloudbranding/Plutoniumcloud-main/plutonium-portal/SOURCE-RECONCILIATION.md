# R05 current desktop source candidate

Owner: reconciliation agent. Branch: `reconcile/chat-window`. Base: main `3ecfa4c8b8e369264bc680d25cabf1948c542913`. Fresh fetch and ownership review retained active Users/PR #3 at `932fd32659afe621dbc405d52aa279fa23bf1913`; historical Chat branch remains `88fbae47c28d75dd06297a9c87a3478ab0866c1a`. No existing branch or PR was merged, rebased or overwritten.

## Selected derivation

R03/draft PR #7 at `334af34e96a7426f004f6169041180ecc9f7edc0` independently reconstructed the nine operator-reported current portal files. This candidate adopts only the reviewed seven public assets/window modules and derives the server from that current baseline. It does not merge its branch, copy its encoded evidence/helper directory, or rewrite its pinned source. Public assets retain their LF content, with redundant final blank lines removed in the candidate where present. `chat-window-source.json` records observed before digests, immutable R03 canonical digests and the eight candidate LF digests. These are source provenance, not a production preflight or authorization record.

| Area | Candidate behavior | Acceptance boundary |
| --- | --- | --- |
| Files/Photos/Chat | Shared current window manager; fixed embeds; request-subject/username-scoped existing pilot capability; separate native reconnect | Native accounts/data/authentication still belong to each app. Files linkage does not provision new Chat users or grant native permissions. |
| Cinema | Existing renderer, exact HTTPS `/web/index.html`, dock and scoped capability definitions retained | Server exposes no enabled Cinema capability and denies launch/status pending R08 native per-user assignment. No owner-token module import, credential read or network probe. |
| Invitations | No module/store loading, controls, token inspection, management or acceptance; GET/HEAD 404, writes 405 | R04 containment intent retained; enabled safety/native/provider/store work remains R07. |
| Framing/assets | Private JavaScript modules with JavaScript MIME, no-store, fixed approved app origins, no parent navigation capability | No proxy/Caddy/CSP response change in any native app or live service. |

The observed live Cinema behavior is not replaced or disabled by this source PR. This candidate is explicitly `deployable=false`; it cannot be used as a whole current-release replacement while Cinema is gated. R08 and a fresh reviewed packaging/rollback plan are prerequisites for eventual release readiness. No claim of R05 deployment acceptance or completed rollback acceptance is made.

## Local checks

`npm run check` and `npm test` pass on Windows/Node 24.21.0. Twenty-eight Node cases consist of 19 backend/provenance cases, seven window-model cases and two unchanged historical invitation unit cases. The historical module is disconnected; its old tests do not prove safe enabled invitations.

Backend fixtures use disposable copied source, fake identities/keys and an unknown-format state file. Missing historical invitation module and booby-trapped historical Plex/invitation modules prove startup does not import them. A local TCP sentinel receives zero connections despite supplied synthetic legacy Plex variables. Foreign subjects, changed usernames, administrator groups and forged gateway requests cannot inherit pilot capabilities. Invitation matrices retain denial through Origin/Fetch Metadata/elevated-profile/foreign-token/concurrency attempts and preserve unknown state unchanged. Source/config/state remain private.

`npm run test:browser` uses prototype-lock-pinned Playwright Core 1.65.0 through process-local `NODE_PATH` and installed Windows Chrome. Every nonlocal request is fulfilled or aborted. Synthetic Files/Photos/Chat frame state survives minimize/focus/mobile switching; drag/resize/snap/maximize, phone/Home behavior, Chat reconnect with no opener, reload/close and wrong-subject/URL capability rejection pass. Disabled Cinema creates no frame or status request; admin/inviter invitation controls are absent. Desktop/phone screenshots are ignored local artifacts and visually inspected. No native login, playback, keys/history, inference, Safari, Linux or gateway acceptance is inferred.

During adaptation, the denial matrix first caught an identity-less invitation request falling through to 401; an explicit generic invitation guard restored the intended 404. The first browser run flagged console errors from intentional 404 probes; moving those probes to the browser test HTTP client preserved a strict zero-unexpected-console-error check. Subsequent runs passed. Neither finding involved live execution.

## Remaining release work

R08 must establish native per-user Cinema authorization without shared owner metadata. R07 retains enabled identity/onboarding/provider/store ownership and gates. Before deployment capture fresh bounded exact current portal source, Compose and linked-config preservation identities through the reviewed operator path; the dated R02 Chat Compose observation is not portal Compose evidence. Prepare one current-source packet with exact before/after/backup bytes, private ownership/modes/locking and partial-failure behavior. Exercise narrow rollback against disposable files, including refusal on newer edits, and preserve invitation/audit/native data across source rollback. Those runtime helper/rollback tests and native browser acceptance are not completed by this source candidate.

Never rerun historical `deploy-portal.py`, Chat/Cinema/install/admin-resume helpers, rebuild old packets to force hashes to match, or change proxy/network/identity settings for this source PR. No source staging on Ubuntu, privileged command, configuration/identity/account/data change, merge, cleanup or deployment occurred. Main integration and the immutable notes snapshot remain separately recorded on `reconcile/handoff`. Next independent source item is R06 issue #4 branding after fresh scope/activity verification; no branding implementation is included here.
