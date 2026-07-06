---
name: O2O dev port setup
description: How the two dev servers are split to avoid port conflicts in Replit
---

API server defaults to port 3001 in dev (env var PORT=3001 in shared).
Vite admin panel dev server binds to 0.0.0.0:5000 (the Replit webview port).
Vite proxies /api and /uploads to localhost:3001.

In production (deployment), PORT=5000 in production env; Express serves the built admin SPA as static files from artifacts/admin-panel/dist under /admin-assets/.

**Why:** Replit previews must be on port 5000. Running two processes on the same port causes EADDRINUSE at startup.

**How to apply:** Never change PORT in shared to 5000. Keep production PORT=5000 in the "production" environment only.
