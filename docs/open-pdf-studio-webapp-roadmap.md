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

## Branding and Design System — Plutonium Cloud

**Planning only.** This section documents the established Plutonium Cloud design system, identifies remaining consistency work, and distinguishes existing implementation from proposed improvements. It is not authorization to redesign or deploy, and no styling changes are implied.

### 1. Established visual identity

**Design direction (attributed to the supplied design inventory, not independently verified):**

- **Palette:** Monochrome — near-black (#0a0a0a), white (#ffffff), and neutral grays. No new decorative color accents without Adrian’s approval. Native warning, error, and success colors are preserved where they communicate meaning.
- **Atmosphere:** Minimal, private-club/speakeasy — generous whitespace, precise alignment, fine borders, subtle grain, faint orbital/line-art decoration.
- **Motion/depth:** Quiet motion, restrained depth, rounded surfaces. Motion generally 250–400ms using `cubic-bezier(.22,1,.36,1)` or `ease-out`; no bouncing. Preserve reduced-motion handling, visible keyboard focus, responsive layouts, and usable native controls.
- **Copy:** Welcoming and personal, not sales-oriented.
- **Logo/favicon motif:** A circular orbit crossed by a tilted elliptical orbit, drawn with thin monochrome strokes. Main wordmark: PLUTONIUM / CLOUD. Native app variants include PLUTONIUM / PHOTOS and Files assets. Native Photos assets use #111111 strokes/text on light backgrounds and #ffffff on dark backgrounds (“light” filenames mean assets for light backgrounds).
- **Typography:** Font stack `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`. Regular body weight 400; lighter display headings 300–400; wordmarks/labels generally 500; primary buttons 600; avoid 700+ below 1rem. Uppercase with tracking for wordmarks/labels/buttons/metadata; normal case for prose.
- **Spacing/radii:** 4px base spacing (4, 8, 12, 16, 24, 32, 40, 48, 64px) with optical adjustments outside that scale. Shared radius token 24px; login cards 24px desktop / 20px mobile; app cards 16px; search 9px; appearance dialog 22px desktop / 16px mobile; small controls ~8–10px; pill buttons/badges 100px; circular avatars/icons 50%.

**Referenced design inventory (attributed; outside this repository — not independently verified):**

- `../DESIGN_SYSTEM.md` — original aesthetic guide; some values differ from implementation
- `plutonium-branding/tokens.json` — shared branding tokens
- `plutonium-branding/README.md` — token generation and adapter scope
- `plutonium-portal/public/styles.css` — portal implementation
- `plutonium-portal/public/index.html` — dark scheme and favicon reference
- `plutonium-portal/public/mark.svg` — portal favicon asset
- `plutonium-branding/assets/` — shared wordmark/favicon
- `plutonium-branding/native-apps/logo-v2/` — Photos light/dark assets
- `plutonium-branding/native-apps/immich-plutonium-v2.css` — Photos palette/logo adapter
- `plutonium-branding/native-apps/IMMICH-BRANDING-V2.md` — accepted scope and exclusions
- `plutonium-branding/nextcloud-header/assets/` — Files branding variants

### 2. Compact token/reference table

| Token category | Shared branding tokens (`plutonium-branding/tokens.json`) | Portal CSS (current implementation) | Status |
|---|---|---|---|
| Background | `#0a0a0a` | — | Existing (shared) |
| Surface | `rgba(14,14,14,.92)` | `rgba(14,14,14,.72)` (card surface) | Differing |
| Foreground | `#ffffff` | — | Existing (shared) |
| Secondary text | `rgba(255,255,255,.85)` | — | Existing (shared) |
| Muted text | `rgba(255,255,255,.62)` | white at `.58` | Differing |
| Faint text | `rgba(255,255,255,.35)` | white at `.28` | Differing |
| Border | `rgba(255,255,255,.12)` | white at `.08` (subtle border) | Differing |
| Input border | `rgba(255,255,255,.24)` | white at `.18` | Differing |
| Focus | `rgba(255,255,255,.8)` | — | Existing (shared) |
| Primary button | `#ffffff` with `#0a0a0a` text | — | Existing (shared) |
| Primary hover | `#e5e5e5` | — | Existing (shared) |
| Light theme | Not established | Dark scheme declared on portal login | Partial |
| Photos light primary | #323232 | — | Existing (Photos native) |
| Photos dark primary | #e5e5e5 | — | Existing (Photos native) |

**Theme state:** The inspected portal login declares a dark color scheme. A complete portal light-theme token set has not been established. Native Photos supports both themes while preserving native layout and user appearance preference; Photos primary scales (50–950) exist for light and dark but are not a complete global light/dark surface specification. If proposing a portal light theme, label its palette and implementation as future work requiring a decision.

**Logo/favicon state:** The accepted orbital logo motif exists (circular orbit crossed by tilted elliptical orbit). The portal `mark.svg` and shared `favicon.svg` currently show a white outlined access/briefcase-like symbol on a #0a0a0a rounded square — they differ from the orbital logo. The accepted 3D dithered atom is a desktop decorative element; do not assume it replaces the logo or favicon. Treat favicon/logo unification as a possible roadmap decision, not an already completed change. Reuse existing assets before proposing replacements.

### 3. Current application coverage and explicit differences

**Established / accepted (no change implied):**
- Shared branding tokens exist in `plutonium-branding/tokens.json` for background, surface, foreground, secondary/muted/faint text, border, input border, focus, primary button, primary hover.
- Native Photos supports both light and dark themes with established primary scales and palette/logo adapters.
- Native Photos branding is preserved (favicon, browser title, metadata, accessibility labels, mobile-app branding unchanged per the accepted web-logo adapter).
- Native warning/error/success colors are preserved where they communicate meaning.

**Explicit differences (documented, not silently reconciled):**
- Portal card surface (`rgba(14,14,14,.72)`) differs from shared token (`rgba(14,14,14,.92)`).
- Portal muted/faint/border/input-border opacities differ from shared token values.
- Portal `mark.svg`/`favicon.svg` differ from the orbital logo motif.
- No complete portal light-theme token set exists.
- Token values are partly hardcoded today; a unified named token system is proposed work, not an existing completed system.
- Portal appearance settings affect portal chrome only; they do not automatically restyle embedded applications across origins.

**Web-unit touchpoints in this repository (`open-pdf-studio/`):**
- `index.html:7` — `<title>Open PDF Studio</title>` and `favicon.ico` reference
- `index.html:9` — inline theme CSS (background `#f5f5f5` light, `#1a1a2e` dark)
- `styles.css` — 26 style modules (`base.css`, `fonts.css`, `themes.css`, `titlebar.css`, `ribbon.css`, `dialogs.css`, etc.)
- `web-unit/voorbeeld/index.html:6` — example page title
- `js/i18n/` — app name strings across 37 languages × 8 namespaces (~296 JSON files)
- `package.json:3` — `name: "open-pdf-studio"`, `version: "2026.46.3"`
- `scripts/web-statistics.mjs` — analytics loader script reference

These touchpoints currently reflect Open PDF Studio branding, not Plutonium Cloud branding. Rebranding them is proposed work, not completed.

### 4. Prioritized remaining branding work

| Priority | Item | Type | Completion criteria |
|---|---|---|---|
| 1 | Document token ownership (shared vs portal vs native-apps) | Documentation | Owner per token set identified; `plutonium-branding/README.md` adapter scope noted |
| 2 | Review existing token differences (surface, muted/faint/border/input-border opacities) | Review | Differences cataloged; no silent replacement of one token set with another |
| 3 | Decide favicon/logo consistency (orbital logo vs portal `mark.svg`/`favicon.svg`) | Decision | Decision recorded; existing assets reused before proposing replacements |
| 4 | Define portal light-theme token set (if Adrian wants one) | Proposed, future work | Palette labeled as future work; requires Adrian decision; not a complete global surface spec |
| 5 | Maintain native-app adapters (Photos, Files) without reopening accepted scope | Preservation | Native Photos favicon/title/metadata/a11y/mobile branding unchanged; adapter scope per `IMMICH-BRANDING-V2.md` respected |
| 6 | Rebrand web-unit touchpoints (title, favicon, theme CSS, i18n app-name strings) | Proposed | Applied only after design schema obtained; no guessing at colors/assets |
| 7 | Align iframe host page (plutoniumcloud.com/desktop, outside this repo) with unit | Proposed, host-side | Host page and unit share one visual language; follows Phase 3 iframe embed |

**What is explicitly out of scope for branding standardization:**
- No framework migration merely to standardize branding.
- No native-app rewrite merely to standardize branding.
- No new dependency introduced merely to standardize branding.
- No broad redesign merely to standardize branding.
- Authentication, native controls, user data, and existing project boundaries are preserved.

### 5. Decision needed before rebranding work begins

Obtain the Plutonium Cloud design schema (design tokens, assets) before touching any styling. Then a dedicated rebranding phase follows Phase 3 (iframe embed) so the host page and unit share one visual language. Do not mark repository assets as deployed merely because they exist. Preserve user-accepted branding without reopening it for unnecessary verification.

## Open decisions (need answers before Phase 2–4)

1. Docker registry & image naming for the static host.
2. Exact plutoniumcloud URL path for the iframe (root `/desktop` or `/desktop/pdf`?).
3. How host authenticates to Nextcloud per user (OIDC token passthrough vs service account).
4. Node version alignment (portal = Node 24+; CI for web = Node 22).
5. Whether to bump version and follow `CLAUDE.md` push/release ritual for a web-only artifact.

## Suggested first action

Run Phase 1: `npm ci && npm run build:web-unit` in `open-pdf-studio/`, then scan `dist-web-unit/` for Tauri/desktop symbols. This confirms the core premise (web-only build works) before any infra work.

I will not commit or push unless explicitly asked.
