# Private authenticated portal deployment

The local prototype remains unchanged on Windows port 8766. This source is a separate, real gateway-backed portal. It is not deployed yet.

## What is implemented

- The entrance page hands password/MFA handling to authentik. It never collects a password or pretends to validate one.
- The desktop/API use the identity verified by authentik's embedded gateway on each request. No example profiles, sample file lists, or browser-side identity switching.
- Caddy strips caller-supplied identity headers before authenticating requests. A separate generated server-only bridge key prevents access to the backend with forged identity headers, even through its private port.
- The backend requires `plutonium-members`. Host-desktop visibility additionally requires the separate `plutonium-admins` group; an `akadmin` username alone grants no portal administration rights.
- No browser tokens/localStorage credentials or custom password database. The existing authentik gateway manages authentication/session validation.
- File/photo account-linking, Plex invitations, chat, and VM creation remain unavailable until configured. No shared administrator application session is supplied to members.

The reviewed Users and Invitations release is packaged from an explicit allowlist containing the updated server/public files, `invitation-service.cjs`, `package.json`, and its focused test. The deployment helper validates each source hash and the deterministic archive hash before extraction; it does not package environment files, secrets, tokens, databases, invitation data, logs, or user exports. The persistent invitation store is created separately at `/var/lib/homelab-portal/invitations.json`, root-owned with mode `0600`, and passed only as `PC_INVITATIONS_PATH`. Delivery remains explicitly `mock` until an approved mail provider exists.

## First, read-only verification

```bash
sudo python3 /home/adrian/homelab-portal/deploy-portal.py check
```

Expected: nine `Identity preflight` checks are `True`, followed by `READ-ONLY PORTAL INTEGRATION CHECK PASSED`. This command uses SELECT-only identity-database inspection with a session-scoped read-only transaction setting. It prints booleans, never passwords/tokens. It also verifies the existing trusted HTTPS services. No containers, files under the deployment root, proxy settings, accounts, or database records are changed.

Checks include application slug, single-app forward-auth mode, exact external URL, a single enabled non-negated membership binding, ordinary group permissions, initial pilot membership, embedded-outpost assignment, and its permanent HTTPS URL.

## Installation phase, after verification and confirmation

```bash
sudo python3 /home/adrian/homelab-portal/deploy-portal.py install
```

Creates one read-only, capability-dropped portal container from a pinned official Node 24 runtime. The process uses UID 0 only because the persistent invitation file must remain root-owned and mode `0600`; the container has no capabilities, `no-new-privileges`, a read-only source mount, and no Docker/libvirt sockets. Source and a private generated gateway key are stored under `/srv/homelab-host/portal`. The backend is published only at `127.0.0.1:13000`. Limits: 256 MiB RAM, one logical CPU, bounded logs.

If the read-only inspection reports the existing legacy deployment (`private_portal_ready`, payload `0f1c06…`), use the guarded migration instead:

```bash
sudo python3 /home/adrian/homelab-portal/deploy-portal.py upgrade
```

The migration verifies the legacy source and compose hashes, preserves the bridge key/Caddy route, retains a recoverable copy of the old app/config, and creates the root-owned `0600` invitation store. It rolls the legacy container back automatically if the replacement cannot start or pass its private backend check.

The helper appends only the root-domain private vhost to Caddy. It retains the current LAN bind/source restrictions and certificate DNS-01 method. It validates Caddy before writing, saves a root-private backup/hash record, writes the existing file in place to preserve its Docker bind inode, and gracefully reloads it. It does not edit current Nextcloud/Immich/auth routes, SSH, UFW, account mapping, router forwarding, or public DNS.

Expected: `PRIVATE AUTHENTICATED PORTAL READY`. It must first verify trusted TLS, existing application health, anonymous/forged-header denial for every personal route, private backend denial without its key, and embedded gateway routing. Positive browser login and nonmember rejection still require separate live tests.

If certificate issuance is pending, preserve configuration and review output; do not repeat installation. After confirming state is appropriate:

```bash
sudo python3 /home/adrian/homelab-portal/deploy-portal.py resume
```

Resume rechecks the saved configuration and waits; it does not recreate keys or restart certificate issuance.

### Rollback

```bash
sudo python3 /home/adrian/homelab-portal/deploy-portal.py rollback
```

Restores the saved Caddy file only if current hashes match this deployment, then removes only the new portal project's container/network. Source/key files remain. It does not delete or change accounts, Nextcloud/Immich/Plex data, identity data, or unrelated proxy edits. Retain current SSH/admin sessions until browser tests pass. No reboot needed and no SSH configuration change is included.

**Secret-handling change:** once installed, the live Caddyfile contains a private portal-to-backend bridge key. Do not print it or paste it into chat. Protected backups may contain it too. Existing DNS token values still remain in the proxy environment, not source assets.

## Browser access after installation

Add only the private router DNS entry `192.168.8.153 plutoniumcloud.com`, preserving existing hosts. The current router lookup returned no root-domain A record. Do not add a public Cloudflare address record at this stage.

From LAN/Tailscale, open `https://plutoniumcloud.com`, choose Enter, sign in through `https://auth.plutoniumcloud.com`, and complete MFA. The desktop must show the actual account identity. Test a separate member and nonmember before any publication. The portal root remains LAN/Tailscale-only until a separate reviewed public-ingress change.

## Validation already completed

- Six Node security tests: direct forged-header rejection, key-without-identity rejection, nonmember rejection, per-request identity separation/query spoof resistance, explicit admin-group requirement, and source/secret-file/write-route protection.
- Browser checks with isolated local test gateway identities: no preview controls/sample data, account dialog, app search, 390px mobile layout, and untrusted display-name escaping.
- These tests do not claim to prove live authentik sessions. The deployment performs negative checks through the actual Caddy gateway, followed by user-driven positive login tests.
