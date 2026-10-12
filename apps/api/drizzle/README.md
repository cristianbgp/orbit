# Database deployment checkpoints

## Immutable migration history

Every committed migration may already have run in Railway and is therefore
immutable. Never add, remove, or rewrite statements in an existing numbered
migration. Any schema, data, function, trigger, or index change must be placed
in a new migration with the next number and registered in
`meta/_journal.json`. Migration tests must exercise the same sequence that an
existing production database will receive.

## User alias expand/contract rollout

Migration `0009_bizarre_dragon_lord.sql` is the expand phase. It adds and
backfills `user.alias`, but deliberately leaves the column nullable so an old
Railway instance can continue creating users while the new release rolls out.
The application must keep generating aliases for new users and resolving a
deterministic valid fallback at every API read boundary during this phase.
Migration and fallback search share `public.orbit_generate_user_alias`. Both
that function and the application generator use the same pinned Orbit v1
letter/decimal-digit repertoire and uppercase mapping, avoiding differences
between the Unicode tables shipped by Bun and PostgreSQL. Other numeric
categories use the deterministic `ORBIT` fallback during generation; editable
aliases still accept the full Unicode number category.

Do not deploy a `SET NOT NULL` migration with this release. The contract phase
is a separate deployment and may begin only after all of these checks pass:

1. This release is fully serving traffic and every old application instance
   has drained.
2. A final backfill has resolved every remaining null or invalid alias.
3. A production query confirms there are zero null aliases.
4. Only then, generate and deploy a new migration that sets `user.alias` to
   `NOT NULL`.

Before the expand release, verify Railway has not already recorded the older
unsafe form of migration `0009`. If it has, stop the rollout and prepare an
explicit remediation migration; editing an already-applied migration will not
change that database.

## User avatar color rollout

Migration `0018_user_avatar_color.sql` adds the required
`user.avatar_color` column with a lowercase hexadecimal check. It backfills
every existing user with the same color produced by the original four-color
avatar palette, so the deployment does not unexpectedly change established
identities.

The migration is compatible with an overlapping previous API container:

- the database default lets old application versions continue creating users
  without sending `avatar_color`;
- the new API validates updates against the ten-color Orbit palette;
- the Better Auth create hook assigns new users a deterministic color from the
  expanded palette;
- the web app computes the accessible foreground and never persists it.

`bun run auth:generate` must preserve all three database policies after Better
Auth rewrites `src/db/auth-schema.ts`: `avatar_color` remains `NOT NULL`, the
lowercase hexadecimal check remains present, and the one-studio membership
index remains unique. The preservation test and a temporary
`drizzle-kit generate` drift check must pass before deployment. Never edit
`0018` after it has been applied; any palette-storage policy change requires a
new migration.

After deploying, verify the migration and stored values:

```sql
SELECT id, created_at
FROM drizzle.__drizzle_migrations
ORDER BY id DESC
LIMIT 3;

SELECT
  count(*) AS users,
  count(*) FILTER (WHERE avatar_color IS NULL) AS null_colors,
  count(*) FILTER (
    WHERE avatar_color !~ '^#[0-9a-f]{6}$'
  ) AS invalid_hex_colors
FROM "user";
```

Both exception counts must be zero. Membership and historical assignment
snapshots do not duplicate this preference: current identities resolve the
live user color, while removed identities may return a null presentation color
and use the deterministic UI fallback.

## Project date contract rollout

Migration `0014_prepare_project_date_contract.sql` is the application-contract
preparation phase. It makes `end_date` required, permits the new application to
omit the two legacy date columns, and mirrors compatibility values inside the
database so a previous container or rollback remains safe during Railway
deployment overlap.

Migration `0015_drop_legacy_project_dates.sql` is the completed cleanup phase.
It may be deployed only after the `0014` application is fully serving traffic
and every previous container has drained. It removes the two compatibility
triggers/functions, legacy indexes, and legacy columns while preserving all
`project_event` records, including `legacy-legal:*` rows.

After `0015`, rolling back to an application version that reads or writes the
legacy columns is unsupported. Any later database change must use a new
immutable migration beginning with `0016`.

## Feature flag operations

Migration `0017_feature_flags.sql` adds backend-owned global values and
organization overrides. Supported keys remain defined in the application
catalog; inserting an unknown key does not expose a new frontend capability.

Set or update a global value:

```sql
INSERT INTO feature_flag (key, organization_id, enabled)
VALUES ('orbit_help_assistant', NULL, false)
ON CONFLICT (key) WHERE organization_id IS NULL
DO UPDATE SET
  enabled = EXCLUDED.enabled,
  updated_at = now();
```

Set or update an override for one organization:

```sql
INSERT INTO feature_flag (key, organization_id, enabled)
VALUES ('orbit_help_assistant', 'replace-with-organization-id', true)
ON CONFLICT (key, organization_id) WHERE organization_id IS NOT NULL
DO UPDATE SET
  enabled = EXCLUDED.enabled,
  updated_at = now();
```

Remove an override to return that organization to the global value:

```sql
DELETE FROM feature_flag
WHERE key = 'orbit_help_assistant'
  AND organization_id = 'replace-with-organization-id';
```

### Enabling Preguntar a Orbit

Before enabling `orbit_help_assistant` for an organization:

1. Add `GROQ_API_KEY` to the Railway API service.
2. Optionally set `ORBIT_HELP_MODEL`; it defaults to `openai/gpt-oss-20b`.
   Before redeploying, remove or replace any Railway override that still uses
   the retired `llama-3.1-8b-instant` or `llama-3.3-70b-versatile` model.
3. Review the Groq account's data-retention controls and enable Zero Data
   Retention when it is available for the account.
4. Redeploy the API, then enable an organization override with the SQL above.

Missing Groq configuration does not prevent the API from starting; the gated
help endpoint returns `503` until it is configured. The first implementation
allows 10 accepted provider requests per rolling hour and 30 per rolling day
per user and API process. Keep the global flag disabled while validating the
organization-only rollout.
