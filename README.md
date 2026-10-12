# Orbit

Orbit is an open-source workspace for legal studios to coordinate clients, projects, cases, tasks, procedural updates, events, responsibilities, and studio-wide activity.

The product is currently Spanish-first and optimized for the workflows of a legal studio. It is under active development and should be evaluated carefully before being used for production legal data.

## What Orbit includes

- Client directory and searchable legal portfolio.
- Projects with stages, team supervision, tasks, events, Kanban, and timeline views.
- Legal and tax cases with structured classification, team and follow-up groups, updates, actions, events, and a weekly presentation mode.
- Personal work views for assigned tasks, supervised projects, and case actions.
- Immutable activity history for relevant project and case operations.
- Organization onboarding, invitations, profiles, aliases, professional positions, and organization time zones.
- Global command search and an optional documentation-only Orbit assistant.

The detailed product model and current decisions live in [`docs/blueprint`](docs/blueprint/README.md).

## Stack

- **Runtime and tooling:** Bun 1.4.0, TypeScript.
- **Web:** React, Vite, Tailwind CSS, shadcn/ui primitives, TanStack Query, React Router.
- **API:** Hono, Zod OpenAPI, Better Auth.
- **Data:** PostgreSQL, Drizzle ORM, incremental SQL migrations.
- **Contracts:** OpenAPI and an Orval-generated web client.
- **Tests:** Vitest, Testing Library, and PGlite.
- **Deployment used by the maintainers:** Cloudflare Pages for the web app and Railway for the API and PostgreSQL.

## Repository layout

```text
apps/
  api/       Hono API, authentication, domain services, migrations, and seed
  web/       React application and generated API client
docs/
  blueprint/ Current product and architecture documentation
scripts/     Repository setup utilities
```

The repository intentionally keeps separate lockfiles for the root tooling, API, and web application. Use the installation commands below instead of assuming a Bun workspace install.

## Prerequisites

- [Bun 1.4.0](https://bun.com/)
- PostgreSQL available locally
- The PostgreSQL command-line tools, including `createdb`

The default development database is `postgres://localhost:5432/orbit`.

## Local setup

```bash
git clone https://github.com/cristianbgp/orbit.git
cd orbit
bun install --frozen-lockfile
bun run install:apps
bun run env:setup
bun run db:setup
bun run db:seed
bun run dev
```

`bun run env:setup` creates missing application `.env` files from their examples and never overwrites existing files.

The seed is intended only for local development. It refuses to run in production and creates this demonstration login:

```text
Email: demo@orbit.local
Password: OrbitDemo123!
```

Never reuse the demonstration password outside a disposable local database.

## Environment variables

API variables are documented in [`apps/api/.env.example`](apps/api/.env.example):

- `DATABASE_URL`: PostgreSQL connection string.
- `BETTER_AUTH_SECRET`: random secret containing at least 32 characters.
- `API_URL`: public API origin.
- `CORS_ALLOWED_ORIGIN`: exact web application origin.
- `API_DOCS_ENABLED`: enables local OpenAPI and Swagger routes when set to `true`.
- `AUTH_TRUST_SIGNUP_EMAIL`: temporary opt-in that marks new signup emails as verified. It defaults to `false` and should remain disabled for normal production deployments.
- `GROQ_API_KEY`: optional key for the documentation assistant.
- `ORBIT_HELP_MODEL`: optional Groq model override.

Web variables are documented in [`apps/web/.env.example`](apps/web/.env.example):

- `VITE_API_BASE_URL`: API origin used by the browser.
- `ORVAL_OPENAPI_URL`: OpenAPI document used when regenerating the client.

Do not commit `.env` files. Only `.env.example` files belong in source control.

## Common commands

| Command              | Purpose                                    |
| -------------------- | ------------------------------------------ |
| `bun run dev`        | Run web and API together through mprocs    |
| `bun run dev:web`    | Run only the Vite application              |
| `bun run dev:api`    | Run only the Hono API                      |
| `bun run db:migrate` | Apply committed Drizzle migrations         |
| `bun run db:seed`    | Recreate the local demonstration data      |
| `bun run typecheck`  | Type-check both applications               |
| `bun run test`       | Run all web and API tests                  |
| `bun run build`      | Build the production web and API artifacts |
| `bun run help:check` | Verify the generated Orbit help corpus     |
| `bun run api:check`  | Regenerate and verify the Orval API client |

Committed database migrations are immutable. Create a new migration for every schema change; never edit a migration that may already have run in another environment. See [`apps/api/drizzle/README.md`](apps/api/drizzle/README.md).

## API documentation and client generation

With the local API running and `API_DOCS_ENABLED=true`:

- OpenAPI JSON: `http://localhost:3210/openapi.json`
- Swagger UI: `http://localhost:3210/docs`

Run `bun run api:generate` after changing a public API contract and commit the generated client changes.

## Security and deployment notes

- Orbit is multi-tenant by active organization, but its authorization model and deployment configuration should be independently reviewed before handling sensitive production data.
- `AUTH_TRUST_SIGNUP_EMAIL=true` bypasses email ownership verification for new accounts. It exists only for installations that deliberately operate without email delivery.
- Better Auth is configured to read `X-Real-IP` from the trusted Railway proxy. A different deployment must configure an equivalent trusted proxy and must not expose a spoofable client-IP header directly to the internet.
- The built-in general rate limit is in-memory and process-local. It is not a distributed abuse-prevention boundary.
- Manual password-recovery links are sensitive, expire quickly, and must be delivered only after independently confirming the recipient's identity.
- Configure TLS, HSTS, CSP, backups, monitoring, and secret management in the hosting platform before production use.

Please report vulnerabilities according to [`SECURITY.md`](SECURITY.md).

## Contributing

Read [`CONTRIBUTING.md`](CONTRIBUTING.md) before opening a pull request. By participating, you agree to follow the [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md).

## License

Orbit is available under the [MIT License](LICENSE).
