---
name: O2O DB migrations
description: How to apply DB schema changes for this project
---

This project uses Drizzle schema-push (not migration files).
Run: `cd lib/db && pnpm run push`

The schema lives entirely in lib/db/src/schema/index.ts.
DATABASE_URL is a Replit secret pointing to Neon PostgreSQL (includes neon.tech in URL).
The drizzle.config.ts auto-detects Neon and sets ssl: "require".

**Why:** No migration files exist; the project was initially deployed to Render and used schema push.

**How to apply:** After any schema change in lib/db/src/schema/index.ts, run pnpm run push from lib/db. Do NOT run from workspace root.
