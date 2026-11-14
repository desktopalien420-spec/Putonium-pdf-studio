# M2 — Authentik appearance update

The corrected read-only inventory completed (user confirmed). Target default brand is b9830098-cdee-4507-88a5-f243539c020d (authentik-default). Authentication flow is 38a85953-27b3-47b3-8c74-73b31be08093, default-authentication-flow. Local file media path resolves inside the container to /data/media/public, on the existing persistent /data mount.

## Exact change

Only these existing Brand fields change: branding_title, branding_logo, branding_favicon, branding_default_flow_background and branding_custom_css. Title becomes Plutonium Cloud; new versioned local SVG assets and the reviewed flow-scoped theme supply appearance. The selected authentication Flow's DISPLAY title becomes Welcome home.

No flow designation, stage bindings, policies, MFA requirements, password handling, user/account permissions, certificates, providers, sessions or application mappings change. No proxy/firewall/SSH/DNS edits, service restarts, dependency installs or new public access. The default brand's title/logo/favicon appear in Authentik interfaces; form styling is scoped to native flow hosts/components. Existing native notices/language/MFA/recovery controls remain.

The asset folder plutonium-cloud-m2-20261108-v1 must not already exist. Use Authentik's existing file manager and persist the three new files only. Preserve old assets. The canonical visual tokens remain in the source project for later adapters; this update does not yet restyle Nextcloud or Immich.

## Phase 1 — read-only candidate check

```bash
sudo python3 /home/adrian/homelab-portal/apply-branding.py check
```

Expected: READ-ONLY BRANDING PREFLIGHT PASSED. It checks exact dependencies, image/mount/media inventory, the four-file reviewed payload, current presentation, exact brand/flow, availability of the new media directory, and service HTTPS. It reads a native snapshot and auth-stage guard through an ak shell JSON exchange; no files or settings are created. If it fails, paste only its bounded output and preserve all files.

## Phase 2 — live update after approval

Keep your current akadmin browser session and Ubuntu SSH session open. Style regressions could make browser controls awkward even while authentication remains intact; the SSH rollback below restores the owned fields without requiring a browser login.

```bash
sudo python3 /home/adrian/homelab-portal/apply-branding.py install
```

Expected: PRIVATE IDENTITY BRANDING READY. The script first saves protected before-values under /var/lib/homelab-authentik-branding/state.json (root-only), then adds the new assets and updates the five Brand fields plus Flow title in a database transaction. It refuses concurrent changes to the brand/flow/stage baseline. It verifies unchanged authentication guards, asset bytes and public metadata with trusted HTTPS, then verifies old cloud/portal health. No login/MFA is automated.

Failure triggers a guarded presentation rollback. It restores only owned fields, refuses newer conflicting presentation choices, preserves unrelated authentication changes, and retains unused new assets. All root backup values and signed media URL tokens must remain out of logs/chat.

## Phase 3 — private browser acceptance

1. In a fresh private/incognito window, open the live Plutonium desktop and choose sign-in. The native Authentik page should show the Plutonium wordmark, dark card, white primary button and Welcome home.
2. Sign in as adrian and complete the existing authenticator challenge privately. Confirm the desktop, original Nextcloud files and existing Photos window still work.
3. Separately verify akadmin can still sign in with its existing MFA and open administration. Confirm account-security/recovery controls remain available; do not reveal or consume recovery codes just to test appearance.
4. Observe error/validation and alternative authenticator controls when safely available. Test phone/Safari when available; do not claim these from Chrome desktop emulation alone.
5. Existing browser sessions may retain old styling until reload. Logout, auth mappings and app permissions have not been reconfigured.

The helper's root state remains awaiting_private_login_verification until user acceptance is recorded in project notes. Metadata checks do not prove password/MFA/recovery works in the updated UI.

## Rollback

```bash
sudo python3 /home/adrian/homelab-portal/apply-branding.py rollback
```

Expected: BRANDING ROLLED BACK. Restores previous presentation fields and flow display title. Retains new unused media and protected state. Reload the browser afterward. Recovery performs the database presentation restore before checking unrelated cloud/proxy health, so an unrelated service outage cannot prevent the restore attempt. If health verification fails after restoration, state says presentation_restored_verification_pending; preserve it for follow-up.

Rollback refuses overwriting newer changes to the same branding fields/title. It does not rewrite whole Brand/Flow records or restore unrelated settings. Never delete the root state or media directories to retry. Do not run older Photos/portal rollback scripts for a branding-only issue.

## Verification performed before staging

- Nine isolated guard tests passed against the actual RPC/update functions: no snapshot writes, exact field update sets, concurrent auth change rejection, altered CSS rejection, scoped restore preserving unrelated edits, conflicting newer presentation rejection, persistent-media path guard, signed URL origin/path validation and restore-before-health recovery order.
- Browser-memory initial login preview on installed Authentik over trusted HTTPS passed in Chrome at desktop and 390px phone widths. Native fields/submit remained visible; dark card/white button/24px corners; no overflow or JS errors. No form submission or settings write.
- Theme selectors use supported flow hosts/parts; deprecated host-context selectors were removed. This is not a claim of actual Safari runtime testing.
- CSS contains no network imports, resource URLs, hidden-control or pointer-suppression rules. SVGs parse and contain no scripts or external references.
- The native database/CLI snapshot and media checks must still pass the user-run read-only preflight; local fixtures do not replace that.

References: https://docs.goauthentik.io/customize/branding/ and https://docs.goauthentik.io/customize/file-picker/ . Pinned source version 2026.8.5.
