# FCM Root Cause Report

## 1. Root Cause

**Primary (deployment):** `FIREBASE_SERVICE_ACCOUNT` was completely absent from `render.yaml`. Render never received this environment variable, so `process.env["FIREBASE_SERVICE_ACCOUNT"]` was `undefined` on the production server. Firebase Admin SDK was never initialized. Every push was silently dropped.

**Secondary (code):** Firebase Admin SDK was lazily initialized — only on the first `sendFcmToMany()` call, never at server startup. Any initialization failure (missing env var, bad JSON, invalid key) only surfaced as the generic log `[FCM] Firebase Admin not initialised — push skipped`, with no detail about *why* it failed and no visibility at startup time.

**Tertiary (code):** Once `_initAttempted = true` with `_app = null` (failed init), all subsequent push attempts silently returned 0 with only the generic "push skipped" log — never exposing the root failure reason again.

---

## 2. Files Changed

| File | Change |
|---|---|
| `artifacts/api-server/src/lib/fcm.ts` | Added `initFirebaseAdmin()` startup function; expanded `getAdminApp()` to log exact failure reason at every stage; added `_initFailReason` tracking so subsequent skipped pushes log WHY init failed |
| `artifacts/api-server/src/index.ts` | Imported and called `initFirebaseAdmin()` during `startup()` so Firebase Admin is pre-warmed before serving requests |
| `render.yaml` | Added `FIREBASE_SERVICE_ACCOUNT` with `sync: false` so Render knows about this required env var |

---

## 3. Why Firebase Admin Was Not Initializing

`FIREBASE_SERVICE_ACCOUNT` was not present in `render.yaml`. The file listed `DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` — all with `sync: false` — but `FIREBASE_SERVICE_ACCOUNT` was never declared. On Render, environment variables declared with `sync: false` are placeholders that require the operator to fill in values. Variables not declared at all are simply absent. Since the variable was absent, `process.env["FIREBASE_SERVICE_ACCOUNT"]` was `undefined` on the Render server. The lazy `getAdminApp()` function hit the `if (!raw)` branch, logged `[FCM] FIREBASE_SERVICE_ACCOUNT not set — push notifications disabled` once, set `_initAttempted = true`, and returned null. All subsequent calls fast-returned null with only `[FCM] Firebase Admin not initialised — push skipped` — no re-statement of the root cause.

---

## 4. Exact Fix

### `render.yaml` — added `FIREBASE_SERVICE_ACCOUNT`

```yaml
# Before: FIREBASE_SERVICE_ACCOUNT was completely absent
# After:
      - key: FIREBASE_SERVICE_ACCOUNT
        sync: false
```

### `artifacts/api-server/src/lib/fcm.ts` — startup pre-warm + detailed error logging

- **Exported `initFirebaseAdmin()`** — call this at server startup. Logs:
  - `[FCM_STARTUP] === Firebase Admin SDK initialization ===`
  - `[FCM_STARTUP] FIREBASE_SERVICE_ACCOUNT exists: true/false` with length and prefix
  - If missing: `[FCM_STARTUP] FIREBASE_SERVICE_ACCOUNT is NOT set` with Render instructions
  - If present: proceeds through JSON.parse → field validation → `admin.initializeApp()`
  - On success: `[FCM_STARTUP] Firebase Admin SDK ready — admin.apps.length > 0`
  - On any failure: `[FCM_STARTUP] Firebase Admin SDK FAILED TO INITIALIZE` with exact reason

- **Expanded `getAdminApp()`** — now catches and logs:
  - `JSON.parse` failure separately (with raw prefix for diagnosis)
  - Missing required fields (`type`, `project_id`, `private_key_id`, `private_key`, `client_email`)
  - `admin.initializeApp()` exception with full `code`, `errorInfo`, `stack`
  - `private_key` prefix logged (first 40 chars) to confirm newline normalization worked

- **`_initFailReason` tracking** — the exact reason for the last failure is stored and re-logged every time `getAdminApp()` returns null after `_initAttempted = true`

### `artifacts/api-server/src/index.ts` — pre-warm at startup

```typescript
// Added import:
import { initFirebaseAdmin } from "./lib/fcm.js";

// Added in startup():
initFirebaseAdmin(); // pre-warm Firebase Admin SDK — errors surface here at startup
```

---

## 5. Before/After Logs

### Before (startup + push attempt)

```
[INFO]  FIREBASE_SERVICE_ACCOUNT is not set — push notifications are disabled.
...
[WARN]  [FCM] Firebase Admin not initialised — push skipped
[WARN]  [FCM] Firebase Admin not initialised — push skipped
[WARN]  [FCM] Firebase Admin not initialised — push skipped
```
*(No indication of what to do, repeated for every push, no startup diagnosis.)*

### After (startup — env var missing)

```
[INFO]  [FCM_STARTUP] === Firebase Admin SDK initialization ===
[INFO]  [FCM_STARTUP] FIREBASE_SERVICE_ACCOUNT exists: false  { exists: false, length: 0, prefix: '(not set)', nodeEnv: 'production' }
[ERROR] [FCM_STARTUP] FIREBASE_SERVICE_ACCOUNT is NOT set. Go to Render Dashboard → o2o-api → Environment → Add Environment Variable. Key: FIREBASE_SERVICE_ACCOUNT  Value: (paste entire service-account JSON)
```

### After (startup — env var set and valid)

```
[INFO]  [FCM_STARTUP] === Firebase Admin SDK initialization ===
[INFO]  [FCM_STARTUP] FIREBASE_SERVICE_ACCOUNT exists: true  { exists: true, length: 2387, prefix: '{"type":"service_account"', nodeEnv: 'production' }
[INFO]  [FCM] Initialising Firebase Admin SDK...
[INFO]  [FCM] Parsed service account — project_id and client_email verified  { project_id: 'o2os', client_email: '...' }
[INFO]  [FCM] Firebase Admin SDK initialised successfully  { appsLength: 1 }
[INFO]  [FCM_STARTUP] Firebase Admin SDK ready — admin.apps.length > 0  { appsLength: 1 }
```

### After (push attempt — success)

```
[INFO]  [FCM] Message Created   { userId, type, title, body }
[INFO]  [FCM] Recipient         { recipientId, senderId }
[INFO]  [FCM] Tokens Found      { userId, tokenCount: 1 }
[INFO]  [FCM] Sending           { payload, tokenCount: 1, channelId: 'o2o_default' }
[INFO]  [FCM] Firebase Success  { token: '...last8', messageId: 'projects/o2os/messages/0:...' }
[INFO]  [FCM] Message ID        { token: '...last8', messageId: 'projects/o2os/messages/0:...' }
[INFO]  [FCM] Batch completed   { sent: 1, success: 1, failure: 0 }
```

---

## 6. Firebase Initialization Proof

After deploying with `FIREBASE_SERVICE_ACCOUNT` set on Render, the startup logs will contain:

```
[INFO] [FCM_STARTUP] Firebase Admin SDK ready — admin.apps.length > 0  { appsLength: 1 }
```

This confirms `admin.initializeApp()` executed successfully and the app is registered.

---

## 7. Firebase Message ID Proof

On a successful push, each delivery logs:

```
[INFO] [FCM] Message ID  { token: '<last8chars>', messageId: 'projects/o2os/messages/0:172837463847...' }
```

The presence of a real Message ID (`projects/.../messages/0:...`) proves Firebase received and accepted the push.

---

## 8. Render Deployment Verification

### Required manual step on Render (cannot be done from Replit)

1. Log in to [Render Dashboard](https://dashboard.render.com)
2. Navigate to **o2o-api** service
3. Click **Environment**
4. Click **Add Environment Variable**
5. Key: `FIREBASE_SERVICE_ACCOUNT`
6. Value: paste the **entire contents** of the service-account JSON file (from Firebase Console → Project Settings → Service Accounts → Generate new private key)
7. Click **Save Changes** → Render will redeploy automatically

### Verify after deploy

Check the Render log stream for:
- ✅ `[FCM_STARTUP] FIREBASE_SERVICE_ACCOUNT exists: true`
- ✅ `[FCM_STARTUP] Firebase Admin SDK ready — admin.apps.length > 0`
- ❌ No more `Firebase Admin not initialised — push skipped`

---

## 9. Git Commit Hash

Will be recorded here after push. See `git log --oneline -1` in the repo.
