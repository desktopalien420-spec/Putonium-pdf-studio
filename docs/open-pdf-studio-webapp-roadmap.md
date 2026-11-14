# Roadmap & Implementation Plan — Open PDF Studio Webapp for Plutonium Cloud

## Decisions locked in

| # | Decision |
|---|----------|
| 1 | Artifact: web-unit build (`npm run build:web-unit` → `open-pdf-studio/dist-web-unit/`), NOT the full hosted bundle. |
| 2 | Serving: Caddy static-file passthrough of the bundle; Docker packaging decided by coding agent (no web-bundle Dockerfile exists yet). |
| 3 | Storage: host wires Nextcloud WebDAV per user; web-unit takes `src`/bytes/`File`, returns `Uint8Array` via `exportPdf()`. |
| 4 | Desktop-only features: greyed out as the browser version does. |
| 5 | Infra/Docker: coding agent decides. |
| 6 | Node version & versioning: TBD. |

## Scope (in / out)

**In scope:** web-unit bundle, Caddy static host, iframe embed on plutoniumcloud.com/desktop, `postMessage` protocol driving, host-side Nextcloud read/write wiring, grey-out of desktop features.

**Out of scope:** Tauri desktop crate changes, Rust/pdfium-worker, collaboration-server, MCP, OCR, CAD, signatures, printing, auto-updater, Authentik OIDC inside the iframe (session arrives via host).

## Artifact map

| Item | Location | Owner |
|---|---|---|
| Web-unit bundle | `open-pdf-studio/dist-web-unit/` (build output) | coding agent |
| Dockerfile + Caddyfile | new, under `packaging/` or `open-pdf-studio/` | coding agent |
| Host iframe page | plutoniumcloud.com/desktop repo (outside this repo) | portal team |
| Nextcloud WebDAV client | host page / backend | backend team |

## Roadmap — phases

### Phase 1 — Web-unit build verification (no app source changes)

Verify the web-unit builds standalone without Rust/Tauri and ships no desktop imports.

Steps:
1. `cd open-pdf-studio && npm ci`
2. `npm run build:web-unit` (Vite config `vite.web-unit.config.js`)
3. Grep `dist-web-unit/` for `@tauri`, `__TAURI__`, `plugin:drag`, `desktop-drag-plugin` → must be absent
4. `npm run typecheck` (partial TS) and web-unit tests (`web-unit/*.test.mjs`, `web-unit/demo-e2e.mjs`)

Exit criteria: clean `dist-web-unit/` output, zero desktop symbols, unit tests green.

Blocker note: sandbox currently has no `node_modules` and no Rust/C toolchain. Phase 1 needs only Node + `npm ci`; unblock by installing Node deps when ready.

### Phase 2 — Caddy static host + Docker image

Steps:
1. Add a Dockerfile (under `open-pdf-studio/` or `packaging/`) that runs a minimal static file server (Caddy or nginx) serving `dist-web-unit/`.
2. Caddy config: serve bundle at a sub-path, `try_files` fallback to `index.html`, CSP header permissive enough for the iframe `postMessage` unit (scripts self + `wasm-unsafe-eval`, connect-src to Nextcloud host).
3. Build & push image; run locally to confirm bundle loads (`curl` returns 200, iframe loads the unit).

Exit criteria: `docker build` succeeds, bundle served at 200, iframe loads the unit.

### Phase 3 — Iframe embed on plutoniumcloud.com/desktop

Steps:
1. Minimal host HTML page: `<iframe src="<caddy-url>/web-unit/…">` with `host-origin` attribute so `iframe-brug.js` auto-attaches (`web-unit/src/index.js:67`).
2. Host implements `postMessage` → iframe commands (`laad`, `opslaan`, `zetSchaal`, `gaNaarPagina`, `zetModus`, `zetAnnotaties`) per `api.js`/`iframe-brug.js`.
3. Host validates origins (`gastheerOrigins` in `api.js`).
4. Grey-out desktop-only toolbar items (print/OCR/CAD/signatures) per browser-version pattern.

Exit criteria: iframe loads a PDF via host `laad`, renders, user annotates, host receives `opds:change`/`opds:save` events.

### Phase 4 — Nextcloud WebDAV wiring (host-side, outside the unit)

Steps:
1. Host resolves per-user Nextcloud credentials (from Authentik OIDC session).
2. Host fetches PDF bytes via Nextcloud WebDAV `GET` → passes `bytes` to iframe `laad`.
3. On save: iframe `opslaan` returns `Uint8Array` → host `PUT`s back to Nextcloud WebDAV (same path or new).
4. Error mapping: WebDAV 401/403/404/507 → `opds:error` surfaced in host UI.

Exit criteria: open a user's PDF from Nextcloud, annotate, save back to Nextcloud, reload and see annotations.

### Phase 5 — Auth / session passthrough

Steps:
1. Confirm how the host learns the logged-in user (Authentik OIDC cookie/token). No iframe-internal auth; host passes user context to Nextcloud requests.
2. Enforce per-user file isolation.

Exit criteria: unauthenticated users cannot fetch/save; per-user isolation holds.

### Phase 6 — Polish & release

Steps:
1. Bundle size budget (`web-unit/bundel-budget.test.mjs` guards ~10 KiB gzip entry; PDF.js/pdf-lib load lazily).
2. CSP hardening for production Caddy (`script-src 'self'`, SRI if serving via `build:hosted` instead).
3. README/contrib notes for the webapp deployment path.
4. Version bump per `CLAUDE.md` (minor revision `X.Y.Z → X.(Y+1).0`) only when a push/release is authorized.

## Open decisions (need answers before Phase 2–4)

1. Docker registry & image naming for the static host.
2. Exact plutoniumcloud URL path for the iframe (root `/desktop` or `/desktop/pdf`?).
3. How host authenticates to Nextcloud per user (OIDC token passthrough vs service account).
4. Node version alignment (portal = Node 24+; CI for web = Node 22).
5. Whether to bump version and follow `CLAUDE.md` push/release ritual for a web-only artifact.

## Suggested first action

Run Phase 1: `npm ci && npm run build:web-unit` in `open-pdf-studio/`, then scan `dist-web-unit/` for Tauri/desktop symbols. This confirms the core premise (web-only build works) before any infra work.

I will not commit or push unless explicitly asked.
