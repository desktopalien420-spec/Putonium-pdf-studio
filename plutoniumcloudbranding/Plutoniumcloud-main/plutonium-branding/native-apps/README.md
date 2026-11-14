# Native app appearance pass 1 — partial Nextcloud update; corrected resume pending

Read DEPLOYMENT-PLAN.md. Nextcloud uses native supported CLI text/colors with protected scoped rollback. Immich uses the existing administrator Custom CSS interface with a read-only delivery checker; no server secrets or blanket system config replacement.

Do not assume this packet applies logos/full custom layouts: it deliberately keeps native structures and user appearance preferences. Original shared tokens remain ../tokens.json. Nextcloud background uses its background value; Immich uses neutral light/dark native primary scales and the shared font stack. Future token changes must regenerate/review each adapter; these files do not magically inherit CSS across origins.

Current recovery: see the first section of DEPLOYMENT-PLAN.md. Preserve original root before-state. Use corrected resume after diagnosis, not install. Original helper copy is historical and must not be executed over the new helper.
