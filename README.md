# Guidely

Framework-agnostic TypeScript package, currently only the project foundation. "Guidely" is a working name pending final naming clearance.

## Development

Requires Node.js 24 and pnpm (version pinned in `package.json`).

| Command             | Description                              |
| ------------------- | ---------------------------------------- |
| `pnpm install`      | Install dependencies                     |
| `pnpm build`        | Compile to `dist/` with declarations     |
| `pnpm test`         | Run unit tests                           |
| `pnpm test:package` | Import the built package (after `build`) |
| `pnpm lint`         | Run ESLint and check Prettier formatting |
| `pnpm format`       | Apply Prettier formatting                |
| `pnpm typecheck`    | Type-check without emitting              |
