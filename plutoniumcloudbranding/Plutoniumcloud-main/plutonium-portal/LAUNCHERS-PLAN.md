# Files and Photos launcher update

Authorized by the user's "proceed" after fresh native SSO and daily/recovery permission tests passed in Nextcloud and Immich.

- Preserve the existing Authentik gateway, key, proxy, TLS, firewall, SSH and all service accounts.
- Resolve Adrian by UUID a59fcebe-aee6-4900-b179-1b5c3cd899c2 using read-only Authentik access. Pin links to his gateway UID and username.
- Read the configured Nextcloud provider ID, keeping credentials out of output. Files opens its native OIDC login route; Photos opens Immich's native OAuth launch URL.
- Enable only Files and Photos for that identity. Other members stay unlinked. Native service accounts enforce data permissions; the portal carries no shared service token.
- Back up the two portal files under /var/lib/homelab-portal-launchers. Write subject-specific launcher configuration, restart only homelab-portal-web, then check health, routes, rejected other subjects/direct/anonymous requests and existing cloud HTTPS.
- On failure restore only known old/new file hashes, remove only the newly created launcher configuration, and restart the portal. Preserve backups and update state. Never overwrite unrelated changes.

## Execute

```bash
sudo python3 /home/adrian/homelab-portal/deploy-launchers.py install
```

Expected: FILES AND PHOTOS LAUNCHERS READY FOR ADRIAN. Paste output before browser verification.

Optional read-only preflight:

```bash
sudo python3 /home/adrian/homelab-portal/deploy-launchers.py check
```

Rollback:

```bash
sudo python3 /home/adrian/homelab-portal/deploy-launchers.py rollback
```

Only portal access may briefly pause during its restart. No SSH lockout change. Keep the current SSH and recovery sessions open. No public ingress is introduced. Native browser sign-in testing is still required after helper success.

## Validation

Eight backend security tests passed, including per-subject launcher rights, fixed redirects despite a query-supplied URL, administrator-name spoofing, missing/forged gateway keys, and linked-config non-exposure. Isolated Chrome browser tests passed both new-tab native login destinations, noopener, unchanged account/search/mobile/XSS checks. Browser test destination requests were fulfilled locally; they used no real credentials and do not prove production SSO.
