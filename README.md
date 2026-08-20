# O2O Marketplace

A full-stack **one-to-one marketplace** platform built as a pnpm monorepo, combining a **React Native mobile app (Expo)**, a **React/Vite admin panel**, and an **Express API server** — all sharing a common Drizzle/Postgres database schema.

---

## 📦 Project Structure

```
O2O/
├── artifacts/
│   ├── api-server/       # Express.js REST API + Socket.IO server
│   ├── admin-panel/      # React + Vite admin dashboard
│   └── o2o/              # React Native (Expo) mobile app
├── lib/
│   ├── db/               # Drizzle ORM schema (shared)
│   ├── api-spec/         # Shared API type definitions
│   ├── api-zod/          # Zod validation schemas
│   └── api-client-react/ # Typed API client (React hooks)
├── scripts/              # Utility & build scripts
├── docs/                 # Project documentation
└── patches/              # Dependency patches
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18+
- **pnpm** v8+ — install with `npm install -g pnpm`
- **PostgreSQL** database
- **Expo CLI** (for mobile development) — `npm install -g expo-cli`
- **Android Studio** or a connected Android device (for mobile builds)

### Installation

```bash
# Clone the repository
git clone https://github.com/Henilshingala/O2O.git
cd O2O

# Install all workspace dependencies
pnpm install
```

### Environment Variables

Create a `.env` file in the root and in `artifacts/api-server/`:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/o2o

# Admin credentials (auto-seeded on first start)
ADMIN_EMAIL=admin@o2o.com
ADMIN_NAME=Admin
ADMIN_PASSWORD=your_secure_password

# Other
PORT=3001
```

---

## 🏃 Running the Application

### 1. Push Database Schema

```bash
cd lib/db
pnpm run push
```

### 2. Build & Start the API Server

```bash
cd artifacts/api-server
pnpm run build
pnpm run start
```

> Runs on **port 3001**. Also serves Socket.IO for real-time features.

### 3. Start the Admin Panel

```bash
cd artifacts/admin-panel
pnpm run dev
```

> Runs on **port 5000**. Open [http://localhost:5000](http://localhost:5000) in your browser.

### 4. Start the Mobile App (Expo)

```bash
cd artifacts/o2o
pnpm run start
```

> Scan the QR code with **Expo Go** or run on an Android emulator/device.

---

## 📱 Mobile App (React Native / Expo)

The mobile app (`artifacts/o2o`) is a React Native application built with Expo.

**Key Features:**
- User authentication & session management
- Real-time chat (Direct messages, Groups, Channels) via Socket.IO
- Per-conversation unread message badges
- Emergency contact / Guardian management
- Push notifications (FCM)
- Video splash screen on launch

**Build APK:**

```bash
cd artifacts/o2o
# Build JS bundle
npx react-native bundle --platform android --dev false \
  --entry-file index.js --bundle-output android/app/src/main/assets/index.android.bundle

# Build release APK via Gradle
cd android
./gradlew assembleRelease
```

The APK will be at `android/app/build/outputs/apk/release/app-release.apk`.

**Install on device:**

```bash
adb install o2o.apk
```

---

## 🖥️ Admin Panel (React + Vite)

The admin panel (`artifacts/admin-panel`) is a React/TypeScript SPA built with Vite.

- Manage users, listings, bids, and transactions
- Real-time data via Socket.IO
- Seeded super-admin: `admin@o2o.com`

---

## 🔌 API Server (Express.js)

The API server (`artifacts/api-server`) powers both the admin panel and mobile app.

- **REST API** — typed endpoints shared via `lib/api-spec`
- **Socket.IO** — real-time messaging and notifications
- **Drizzle ORM** — type-safe database queries against PostgreSQL
- **File uploads** — served from `/uploads`

---

## 🛠️ Development Commands

| Command | Description |
|---|---|
| `pnpm run build` | Typecheck + build all packages |
| `pnpm run typecheck` | Run TypeScript checks across the monorepo |
| `pnpm run lint` | Lint all files with ESLint |
| `pnpm run lint:fix` | Auto-fix lint issues |

---

## 🧰 Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native, Expo, TypeScript |
| Admin UI | React, Vite, TypeScript |
| API Server | Express.js, Socket.IO, TypeScript |
| Database | PostgreSQL, Drizzle ORM |
| Monorepo | pnpm Workspaces |
| Validation | Zod |
| Notifications | Firebase Cloud Messaging (FCM) |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License**.
