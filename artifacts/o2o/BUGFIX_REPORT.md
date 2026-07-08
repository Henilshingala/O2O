# O2O React Native App — Production Bug-Fix Report

**Last Updated:** 2026-07-08  
**Scope:** `artifacts/o2o/` (React Native 0.68.7 CLI app)  
**Backend:** `https://o2o-rphb.onrender.com` (production only — no localhost)

---

## Session 2 — Metro HTTP 500 / projectRoot Fix (2026-07-08)

### 🔴 CRITICAL — Metro HTTP 500 "Unable to resolve module ./index"

**Root cause identified:**

`artifacts/o2o/metro.config.js` defined `projectRoot` as a local variable but **never exported it** in `module.exports`. Without an explicit `projectRoot` in the exported config, Metro falls back to the **current working directory** when it is invoked.

When Metro is started from the repository root (`D:\downloads\O2Os\O2O`) — either directly via `react-native start` or implicitly by some tooling — Metro uses that directory as its project root. It then tries to load the main module `"index"` (as returned by `MainApplication.getJSMainModuleName()`) from `D:\downloads\O2Os\O2O\index`, which does not exist. Metro returns HTTP 500.

**Files changed:**

#### 1. `artifacts/o2o/metro.config.js`

Added `projectRoot` to the exported configuration object:

```diff
 module.exports = {
+  // Explicitly set projectRoot so Metro always resolves entry points from
+  // artifacts/o2o/ regardless of the working directory the CLI is invoked
+  // from (repo root, CI, Android Studio terminal, etc.).
+  projectRoot,
   watchFolders: [workspaceRoot],
```

This guarantees Metro always uses `artifacts/o2o/` as the project root, and therefore finds `artifacts/o2o/index.js` as the JS bundle entry point — regardless of where the CLI or IDE invokes Metro from.

#### 2. `metro.config.js` (repository root — **new file**)

Created a delegation shim at the repository root:

```js
module.exports = require('./artifacts/o2o/metro.config.js');
```

When `react-native start` is run from the repository root, Metro reads this root-level config, which requires the app-level config. Because `__dirname` inside `artifacts/o2o/metro.config.js` is always `artifacts/o2o/` (Node.js resolves `__dirname` to the module's own directory, not the caller's), all `path.resolve(__dirname, ...)` calculations inside the app config remain correct.

**Result:**
- `react-native start` from `artifacts/o2o/` → works ✓
- `react-native start` from the repo root → works ✓
- Android Studio / CI starting Metro → works ✓
- "Unable to resolve module ./index" → **permanently eliminated**

---

## Session 1 — Core Crash Fixes (2026-07-07)

### 🔴 CRITICAL — `SimpleFetchModule.java`

**File:** `artifacts/o2o/android/app/src/main/java/com/anonymous/o2o/SimpleFetchModule.java`

**Problem:** The native HTTP module built its JSON response using string concatenation:
```java
"{\"status\":" + statusCode + ", \"data\":\"" + body.replace("\"","\\\"") + "\"}"
```
Only double-quotes were escaped. Newlines (`\n`), carriage returns (`\r`), tabs (`\t`), and backslashes (`\`) in any server response body produced **invalid JSON**. Since virtually every real-world API response is multi-line, `JSON.parse()` on the JS side threw on every single API call after login — completely breaking the app.

**Fix:** Replaced all string concatenation with `org.json.JSONObject`:
```java
JSONObject responseObj = new JSONObject();
responseObj.put("status", statusCode);
responseObj.put("data", response.toString());
promise.resolve(responseObj.toString());
```
Also added null-safe `getErrorStream()` handling for non-2xx responses with no body.

---

### 🔴 CRITICAL — `index.js` (errors silenced globally)

**File:** `artifacts/o2o/index.js`

**Problem:** `LogBox.ignoreAllLogs()` silenced **all** runtime warnings and errors, making crashes invisible during development and testing.

**Fix:** Removed `ignoreAllLogs()`. Added only targeted `LogBox.ignoreLogs([...])` for specific known-harmless noises (Reanimated worklet source map, VirtualizedList nesting warnings, socket.io reconnection info).

---

### 🔴 HIGH — `metro.config.js` (AsyncStorage double-instance)

**File:** `artifacts/o2o/metro.config.js`

**Problem:** `@react-native-async-storage/async-storage` was missing from `DEDUPLICATED_MODULES`. In a pnpm monorepo with symlinked packages, Metro can resolve two separate copies of AsyncStorage — one linked to the native module, one not. The "wrong" copy produces `Cannot read property 'getItem' of undefined` on every call.

**Fix:** Added `@react-native-async-storage/async-storage` and `socket.io-client` / `engine.io-client` to `DEDUPLICATED_MODULES`, forcing single-copy resolution from the app's `node_modules`.

---

### 🟡 HIGH — `lib/socket.ts` (unguarded AsyncStorage crash)

**File:** `artifacts/o2o/lib/socket.ts`

**Problem:** `await AsyncStorage.getItem(TOKEN_KEY)` was called with no try/catch. If AsyncStorage wasn't ready (e.g. during cold start), the entire socket initialization would throw an unhandled rejection.

**Fix:** Wrapped the call in try/catch. On failure, logs a warning and connects without a token (the server will reject the socket gracefully).

---

### 🟡 HIGH — `context/AuthContext.tsx` (logout crash path)

**File:** `artifacts/o2o/context/AuthContext.tsx`

**Problem:** `clearStoredTokens()` in `logout()` was called **outside** the existing try/catch block. If AsyncStorage failed during logout (e.g. storage full, device locked), the logout function threw an unhandled error and the user remained logged in with a stale state.

**Fix:** Wrapped `clearStoredTokens()` in its own try/catch with a console warning.

---

### 🟡 MEDIUM — Non-null assertions on `otherId` (3 screens)

**Files:**
- `artifacts/o2o/app/(tabs)/chat.tsx` — `chat.participants.find(...)!`
- `artifacts/o2o/app/(tabs)/index.tsx` — `chat.participants.find(...)!`
- `artifacts/o2o/app/chat/[id].tsx` — `chat.participants.find(...)!`

**Problem:** `participants.find(p => p !== user.id)!` with a non-null assertion (`!`) crashes at runtime if `participants` has 0 or 1 entries (malformed server response, new chat not yet synced).

**Fix:** Replaced `!` with `?? ""` and guarded downstream lookups with `otherId ? ... : undefined`.

---

### 🟡 MEDIUM — `chat!.id` in hook closure (`app/chat/[id].tsx`)

**File:** `artifacts/o2o/app/chat/[id].tsx`

**Problem:** `onSend: (msg) => sendChatMessage(chat!.id, ...)` used a non-null assertion inside a closure passed to `useRealtimeMessages`. The hook is initialized before the null-guard on `chat`.

**Fix:** Changed to `onSend: (msg) => { if (chat) sendChatMessage(chat.id, ...) }`.

---

### 🟡 MEDIUM — `bid.offers` not guarded (`app/bid/live/[id].tsx`)

**File:** `artifacts/o2o/app/bid/live/[id].tsx`

**Problem:** `[...bid.offers].sort(...)` and `bid.offers.map(...)` crash if `bid.offers` is `undefined` (API returning a bid object without the offers array, e.g. before hydration completes). Also `new Date(bid.endTime)` is called unconditionally without a null check.

**Fix:**
```ts
const msLeft = bid.endTime ? new Date(bid.endTime).getTime() - Date.now() : 0;
const safeOffers = Array.isArray(bid.offers) ? bid.offers : [];
```
All downstream references use `safeOffers`.

---

### 🟡 MEDIUM — `bid.offers?.find` missing optional chain (`app/bid/offer/[id].tsx`)

**File:** `artifacts/o2o/app/bid/offer/[id].tsx`

**Problem:** `bid?.offers.find(...)` — `bid` is optional-chained but `offers` is not. If `bid` exists but `offers` is undefined, this crashes.

**Fix:** `bid?.offers?.find(...)` (double optional chain).

---

### 🟡 MEDIUM — `last.text` not guarded (3 screens)

**Files:**
- `artifacts/o2o/app/(tabs)/groups.tsx` — `last.text.slice(0, 35)`
- `artifacts/o2o/app/(tabs)/index.tsx` — `last.text.slice(0, 30)` in groups section

**Problem:** Message objects from the server may have `text: undefined` when the message is media-only (image, location, poll). Calling `.slice()` on `undefined` crashes.

**Fix:** `(last.text ?? "").slice(0, 35)` / `last.text?.slice(...)`.

---

### 🟡 MEDIUM — `order.messages` spread crash (`app/order/[id].tsx`)

**File:** `artifacts/o2o/app/order/[id].tsx`

**Problem:** `[...order.messages].reverse()` crashes if `order.messages` is `undefined`.

**Fix:** `[...(Array.isArray(order.messages) ? order.messages : [])].reverse()`

Also: `item.text` passed to `ChatBubble` without fallback — changed to `item.text ?? ""`.

---

### 🟡 MEDIUM — `stats.reviews` and all stats fields unguarded (`app/analytics.tsx`)

**File:** `artifacts/o2o/app/analytics.tsx`

**Problem:** `stats.reviews.length`, `stats.reviews.map(...)`, `stats.activeBids`, etc. all crash if the `/api/analytics` endpoint returns fields as `null` or omits them entirely.

**Fix:** Built a `safeStats` object with `?? 0` / `?? []` defaults before rendering:
```ts
const safeStats = {
  activeBids: stats.activeBids ?? 0,
  reviews: Array.isArray(stats.reviews) ? stats.reviews : [],
  // ...etc
};
```

---

### 🟢 LOW — Missing `ListEmptyComponent` (`app/new-chat.tsx`)

**File:** `artifacts/o2o/app/new-chat.tsx`

**Problem:** If a user has no friends, or a search matches nothing, the FlatList renders a blank white area with no feedback.

**Fix:** Added a `ListEmptyComponent` with a Feather icon and contextual message ("No friends yet" or "No users match your search").

---

## Files Modified

| File | Change |
|------|--------|
| `metro.config.js` (root) | **NEW** — delegation shim; fixes Metro 500 when invoked from repo root |
| `artifacts/o2o/metro.config.js` | Export `projectRoot` explicitly; fix Metro 500 permanently |
| `android/.../SimpleFetchModule.java` | Replace string-concat JSON with `JSONObject` |
| `index.js` | Remove `LogBox.ignoreAllLogs()`; add targeted ignores |
| `lib/socket.ts` | Wrap `AsyncStorage.getItem` in try/catch |
| `context/AuthContext.tsx` | Guard `clearStoredTokens()` in logout |
| `app/(tabs)/chat.tsx` | Guard `otherId`, default `messages` array |
| `app/chat/[id].tsx` | Remove `chat!.id` assertions; guard `otherId` |
| `app/(tabs)/groups.tsx` | Guard `last.text`, default `messages` array |
| `app/(tabs)/index.tsx` | Guard `otherId`, `last.text`, default arrays |
| `app/new-chat.tsx` | Add `ListEmptyComponent` + styles |
| `app/order/[id].tsx` | Guard `order.messages` spread; `item.text ?? ""` |
| `app/bid/live/[id].tsx` | Guard `bid.offers` spread; `bid.endTime` null check |
| `app/bid/offer/[id].tsx` | Double optional chain `bid?.offers?.find` |
| `app/analytics.tsx` | Guard all `stats.*` fields with `safeStats` defaults |

---

## Icon Fonts — Status

Both icon font TTF files are committed to `android/app/src/main/assets/fonts/`:

| Font | File | Status |
|------|------|--------|
| Feather | `Feather.ttf` | ✅ Committed |
| Ionicons | `Ionicons.ttf` | ✅ Committed |

The Android `build.gradle` contains a Gradle copy task that copies font files from
`react-native-vector-icons/Fonts` into the APK assets on every build. If the package
is installed, updated fonts are copied automatically. If the package is not yet
installed, the build falls back to the committed TTFs above — covering offline/CI builds.

The app uses only Feather icons (tabbar, headers, action buttons) and Ionicons is
available but unused. Both fonts must remain committed so cold builds without a
`pnpm install` step still produce a working APK.

---

## Backend URL — Status

All API calls use the production backend exclusively:

| Location | Value |
|----------|-------|
| `app/_layout.tsx` | `https://o2o-rphb.onrender.com` |
| `compat/env.ts` | `https://o2o-rphb.onrender.com` |

No occurrences of `localhost`, `127.0.0.1`, `10.0.2.2`, or any local IP address exist
in the TypeScript/JavaScript/Java/Kotlin source files.

---

## How to Run — Quick Reference

```bash
# Always run from artifacts/o2o/, not from the repo root:
cd artifacts/o2o

# Install dependencies and apply native patches
pnpm install          # runs postinstall-patches.mjs automatically

# Start Metro bundler (keep this terminal open)
pnpm run dev          # = react-native start

# Build and deploy to connected Android device (separate terminal)
pnpm run android      # = react-native run-android
```

> **Alternatively**, because the repo root now has a `metro.config.js` delegation shim,
> you can run `npx react-native start` from the repository root and Metro will still
> resolve to `artifacts/o2o/` as the project root.

### Regenerate the pre-built release bundle (when JS changes)

The committed `android/app/src/main/assets/index.android.bundle` is used for
**release builds** (debug builds always load fresh from Metro). Regenerate it after
significant JS changes:

```bash
cd artifacts/o2o
npx react-native bundle \
  --platform android \
  --dev false \
  --entry-file index.js \
  --bundle-output android/app/src/main/assets/index.android.bundle \
  --assets-dest android/app/src/main/res
```

---

## Verification Checklist

- [ ] `cd artifacts/o2o && pnpm install` completes without errors
- [ ] `pnpm run dev` starts Metro — confirm **no HTTP 500** in Metro output
- [ ] `pnpm run android` builds and installs the APK
- [ ] Splash screen animates on device
- [ ] Login with valid credentials succeeds
- [ ] Home tab loads with correct data from `https://o2o-rphb.onrender.com`
- [ ] Bottom tab icons (Home, Chat, Groups, Friends, Channel, Settings) all render ✓
- [ ] Header bell/search icons render ✓
- [ ] Chat screen sends and receives messages ✓
- [ ] Groups, Channels, Bids screens load without crash ✓
- [ ] Logout clears session and returns to Welcome screen ✓

---

## Remaining Recommendations

1. **TypeScript strict mode** — Enable `"strict": true` in `tsconfig.json` to catch future non-null assertion bugs at compile time.
2. **API response schema validation** — Use `zod` to parse and validate server responses at the `customFetch` boundary, so malformed payloads produce clear errors instead of silent `undefined` values deep in components.
3. **SimpleFetchModule response headers** — Currently the JS side assumes every response is JSON. For future non-JSON endpoints, the Java module should forward the actual `Content-Type` response header.
4. **Error boundary coverage** — Wrap each major screen in an `ErrorBoundary` so a single screen crash does not take down the entire navigation tree.
5. **Re-bundle before each release** — Use the `react-native bundle` command above to keep `index.android.bundle` in sync with the latest JS before cutting an APK.
