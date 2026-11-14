# Shared design tokens and Authentik branding — M2 preparation

No live brand, flow, user or file-storage settings have been changed. `tokens.json` is the visual source for generated `tokens.css` and the token section of `authentik.css`; regenerate with `python build-tokens.py` after edits. Tokens use the approved monochrome palette, system/Inter font stack and readable muted text. No external fonts or network CSS imports.

The Authentik adapter targets flow components and their shadow-root descendants. It preserves the native form, validation, MFA, password visibility, language and recovery controls. It does not replace the authenticator or collect credentials. Brand title/logo/favicon/background are proposed cosmetic changes. A proposed authentication-flow display title is “Welcome home.” Changing that title must never change flow designation, stage bindings, policies or MFA requirements.

`assets/` contains an existing portal favicon, the textual Plutonium Cloud wordmark with the existing orbital motif, and a quiet monochrome SVG background. No scripts or external image references. Authentik's supported media manager should store new versioned assets; do not edit container bundles or replace existing media.

## Verified locally

- Native public login loaded in a fresh Chrome browser over trusted HTTPS. CSS and wordmark/title applied ONLY in that browser's memory to document/shadow roots; no forms submitted and no settings saved.
- Screenshots at 1440x1000 and 390x844 visually inspected. Rounded dark card, white primary button, readable native inputs; no horizontal overflow or page errors.
- This validates initial identification layout only. Authenticated/password/MFA/recovery and administrator login must be tested privately by the user after a protected, reversible deployment.
- Static checks: no imported resources, hidden controls, visibility/pointer suppression; all three SVGs parse and contain no scripts/foreign objects/external references.

## Next — read-only inventory

```bash
sudo python3 /home/adrian/homelab-portal/inspect-branding.py
```

Expected: READ-ONLY BRANDING INVENTORY COMPLETE. It reports the exact current brand UUID/domain, CSS presence/hash, selected authentication flow and local media backend. No assets/settings/files are created by this command. Raw CLI logs, cookies and secrets are withheld.

Before a live change, use the actual inventory to prepare a transactionally guarded theme installer: protected before-values and flow display title, new versioned assets only, public metadata/asset verification, unchanged authentication fields, exact rollback through SSH and user approval of the concrete packet. No proxy, port, firewall, TLS-validation, account or MFA changes should be required. Keep the current akadmin session and SSH session open.

The guarded installer is now prepared as apply-branding.py. Read DEPLOYMENT-PLAN.md. Run its read-only check first; the live installation requires concrete approval. Do not apply CSS manually or change recovery flows.

## Preview artifacts

artifacts/authentik-identification-desktop.png and authentik-identification-phone.png show browser-memory styling, not a deployed theme. The CSS is injected into all current shadow roots by the local preview harness; production uses Authentik's supported brand custom-CSS injection. That production delivery path must be verified after application.

## References

- https://docs.goauthentik.io/customize/branding/
- https://docs.goauthentik.io/customize/file-picker/
- https://version-2026-2.goauthentik.io/brands/custom-css/ (conceptual reference; installed version is 2026.8.5)
- Pinned source: https://github.com/goauthentik/authentik/tree/version/2026.8.5/web/src/flow

Inventory note: the installed file backend reports a relative media path (`data/media/public`). The corrected helper resolves it inside the container and prints `media_base_path_resolved`; it still requires the exact `/data/media/public` location and the existing persistent `/data` bind. A raw spelling difference is not a reason to change mounts or move data.

Current inventory: corrected path check completed (user confirmed). The live theme is still unchanged. `python test-branding-guards.py` runs nine isolated safety/recovery checks; these do not replace the native database preflight or real private MFA login verification. The theme now uses flow host/part selectors without deprecated host-context.
