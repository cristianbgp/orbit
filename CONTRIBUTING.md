# Contributing to Orbit

Thank you for helping improve Orbit.

## Before starting

1. Search existing issues and pull requests.
2. Open an issue before undertaking a large product or architecture change.
3. Keep changes focused. Avoid combining unrelated refactors with a feature or fix.
4. Never include client data, production credentials, private legal documents, or internal access links in issues, fixtures, screenshots, or commits.

## Development

Follow the setup in [`README.md`](README.md). Before submitting a pull request, run:

```bash
bun run format:check
bun run typecheck
bun run test
bun run build
bun run help:check
```

When an API contract changes, run `bun run api:generate` with the local API available and commit the generated client.

## Database changes

- Generate a new Drizzle migration for every schema change.
- Never edit an existing committed migration.
- Prefer expand/contract migrations for changes that must survive rolling deployments.
- Include tests for migrations and invariants where practical.

## Tests

- Add regression coverage for fixes and behavior coverage for features.
- Preserve tenant boundaries in service and route tests.
- Use calendar dates for legal dates and timezone-aware instants for technical timestamps.
- Keep fixtures synthetic.

## Pull requests

A pull request should explain the problem, the chosen approach, verification performed, and any deployment or migration impact. UI changes should include responsive screenshots when useful.

Maintainers may ask to split a change when reviewing it safely would otherwise be difficult.
