# Agent Instructions — Open PDF Studio → Plutonium Cloud Webapp

This file is the canonical handoff for any agent working on adapting Open PDF Studio into a Plutonium Cloud webapp served inside an iframe on plutoniumcloud.com/desktop. Read this first before making changes.

## Project facts (Discovery Phase 0 complete)

- Repo: `desktopalien420-spec/Putonium-pdf-studio`, branch `kilo/spirited-beacon-fnr`
- Product: Open PDF Studio — cross-platform PDF editor (Tauri 2 + SolidJS + Vite + PDF.js + pdf-lib + i18next)
- Root: `/workspace/app`; app package: `/workspace/app/open-pdf-studio/`
- Current version: `2026.46.3` (scheme `YYYY.W.N`)
- License: LGPL-3.0-or-later (`LICENSE.md`)
- Remote: `https://github.com/desktopalien420-spec/Putonium-pdf-studio.git`

## Decisions locked in

1. Artifact: **web-unit** build (`npm run build:web-unit` → `open-pdf-studio/dist-web-unit/`), NOT the full hosted bundle.
2. Serving: **Caddy static-file passthrough** of the bundle; Docker packaging decided by coding agent (no web-bundle Dockerfile exists yet).
3. Storage: host wires **Nextcloud WebDAV per user**; web-unit takes `src`/bytes/`File`, returns `Uint8Array` via `exportPdf()`.
4. Desktop-only features: **greyed out** as the browser version does.
5. Infra/Docker: coding agent decides.
6. Node version & versioning: TBD.

## Tech boundaries (what is / isn't in scope)

**In scope for webapp:**
- `open-pdf-studio/web-unit/src/` — `<open-pdf-studio>` custom element + `mount()` API + iframe `postMessage` bridge (`iframe-brug.js`)
- Vite web build config: `vite.web-unit.config.js`, `webAliassen()` in `scripts/web-bouw.mjs` (desktop modules → web stubs)
- Hosted/CSP build: `scripts/gehost-html.mjs` (SRI integrity, no `unsafe-inline` scripts)

**Out of scope (desktop-only, do not touch):**
- `src-tauri/` — Rust backend, 28 commands, file I/O, locking, printing, OCR, CAD, signatures, MCP, auto-updater
- `open-pdf-render`, `pdfium-worker`, `open-pdf-cad`, `open-pdf-cmyk`, `open-pdf-thumbnails`, `open-pdf-signatures`, `open-pdf-security`, `open-pdf-monochrome` — native Rust crates
- `collaboration-server/` — Python shared-review concept (issue #1067), not production

## Environment state

- Node v24.22.1 present; `node_modules` ABSENT in `open-pdf-studio/`; no Rust/Cargo/C toolchain in sandbox
- Commands that need `npm ci`: `npm run build:web-unit`, `npm run typecheck`, `npm run test:unit`, `npm run test:quality`
- Commands needing Rust (blocked here): `npm run dev`, `npm run tauri:dev`, `npm run build` (desktop), `npm run predev`/`prebuild`

## Key scripts

| Script | Purpose | Needs Rust? |
|---|---|---|
| `npm run build:web-unit` | Vite build with `vite.web-unit.config.js` → `dist-web-unit/` | No |
| `OPDS_WEB_BUILD=1 npx vite build` | Public browser version → `dist/` | No |
| `npm run build:hosted` | CSP/SRI bundle for external hosting (`--mode hosted`) | No |
| `npm run pack:hosted` | `scripts/pak-webbundel.mjs` → release archive | No (needs prior hosted build) |
| `npm run typecheck` | `tsc --noEmit` | No (needs `npm ci`) |
| `npm run test:unit` | `node --test` over `scripts/unit-testlijst.txt` (~798 files) | No (needs `npm ci`) |
| `npm run test:quality` | 3 quality regression files | No (needs `npm ci`) |

## Conventions to follow

- Docs language: Nederlands; code/configs: English
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`)
- `CLAUDE.md` rules: strip Adobe/foxit/pdf-xchange references; no Anthropic/Claude in commit messages; bump minor revision `X.Y.Z → X.(Y+1).0` on push; run installer GitHub action + draft release on push
- TypeScript partial: `.ts` for types/state, `.js`/`.jsx` for logic/components
- State: `createMutable` (SolidJS store); vanilla JS reaches SolidJS stores only via `js/bridge.ts`
- Web build aliases: desktop-only modules replaced with web stubs (`scripts/web-bouw.mjs`); `@crabnebula/tauri-plugin-drag` excluded
- i18n: new keys added to ALL 37 language files × 8 namespaces (~296 JSON files)

## Read-only constraint (current session)

Do NOT modify files, install dependencies, or run destructive commands unless explicitly unblocked. Investigation only so far.

## Roadmap

See `docs/open-pdf-studio-webapp-roadmap.md`.

## Handoff notes for next agent

1. Phase 1 build verification COMPLETE:
   - `npm ci` succeeded in `open-pdf-studio/` (Node v24.22.1)
   - `npm run build:web-unit` succeeded → `dist-web-unit/` built in 4.62s, entry `open-pdf-studio.js` 0.22 kB raw / 0.17 kB gzip
   - `grep -rE "@tauri|__TAURI__|plugin:drag|desktop-drag-plugin|crabnebula" dist-web-unit/` → no matches (clean)
   - `npm run typecheck` passed clean
   - Web-unit unit tests: 70 pass / 0 fail (`web-unit/src/api.test.mjs`, `inbedden.test.mjs`, `meten.test.mjs`, `opslaan.test.mjs`, `web-unit/bundel-budget.test.mjs`)
   - `test:web-unit` (demo-e2e.mjs) needs Playwright Chromium — not installed; browser binary download not attempted
2. Phase 2 — Dockerfile + Caddyfile AUTHORED (not built/tested — Docker not available in this sandbox):
   - `open-pdf-studio/Dockerfile` — multi-stage: Node 24 builder → `npm run build:web-unit`; Caddy 2 runner serving `dist-web-unit/`
   - `open-pdf-studio/Caddyfile` — static passthrough at `:80`, `try_files` fallback to `index.html`, CSP for iframe postMessage embedding, `frame-ancestors https://plutoniumcloud.com`, `connect-src` to Nextcloud (placeholder origins — replace before deploy), cache headers for assets
   - Next step: `docker build -t plutonium/open-pdf-studio-web:2026.46.3 .` and `docker run -p 8080:80 …`, then `curl http://localhost:8080/` → 200
3. Phase 3 — iframe host page AUTHORED:
   - `open-pdf-studio/web-unit/voorbeeld/host.html` — reference host page implementing the postMessage protocol (`laad`, `opslaan`, `zetSchaal`, `gaNaarPagina`, `zetModus`, `zetAnnotaties`), origin-gated to `https://plutoniumcloud.com`, Nextcloud WebDAV fetch/save placeholders, desktop-only features greyed out
   - Note: the live host page belongs in the plutoniumcloud.com/desktop repo (outside this repo); this is a reference implementation to adapt
4. Phase 4 — Nextcloud WebDAV wiring is host-side (outside this repo): replace the `fetchPdfFromNextcloud`/`savePdfToNextcloud` placeholders in host.html with real OIDC-authenticated WebDAV GET/PUT
