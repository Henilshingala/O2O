# O2O Project

Imported monorepo (pnpm workspace) with an Express API server, a React/Vite admin panel, and an Expo mobile app (`artifacts/o2o`), sharing a Drizzle/Postgres schema in `lib/db`.

## Running

- `API Server` workflow: `cd artifacts/api-server && pnpm run start` — builds output must exist first (`pnpm run build` in that dir), serves on port 3001. Also hosts the admin panel's backend, API routes, and Socket.IO.
- `Start application` workflow: `cd artifacts/admin-panel && pnpm run dev` — Vite dev server for the admin panel UI on port 5000 (this is what the Replit preview shows).
- Database schema: `cd lib/db && pnpm run push` pushes the Drizzle schema to `DATABASE_URL` (no migration files, schema-push only).
- Super admin account is seeded automatically by the API server on startup from `ADMIN_EMAIL`, `ADMIN_NAME` (env vars) and `ADMIN_PASSWORD` (secret). Currently seeded as `admin@o2o.com`.

## User preferences

None recorded yet.
