# O2O — Buy, Sell, and Bid Platform

O2O is a high-performance, cross-platform e-commerce and communication application. It provides a complete infrastructure for users to buy, sell, negotiate bids, and communicate through real-time channels and groups. 

This repository contains the complete full-stack source code, organized as a modern **PNPM Workspace** monorepo, featuring a React Native frontend (Android, iOS, Web) and a Node.js Express backend connected to PostgreSQL.

---

## 🚀 Tech Stack

### Frontend (`artifacts/o2o`)
- **Framework:** React Native (v0.81) / React Native Web
- **Web Bundler:** Vite (v5)
- **Navigation:** React Navigation v7 (Bottom Tabs, Native Stack)
- **Data Fetching:** TanStack React Query v5
- **Animations:** React Native Reanimated v4
- **Type Safety:** TypeScript & Zod

### Backend (`artifacts/api-server`)
- **Server:** Node.js + Express
- **Database:** PostgreSQL (v13+)
- **ORM:** Drizzle ORM (`artifacts/db`)
- **Authentication:** JWT (JSON Web Tokens)
- **API Spec:** OpenAPI (Swagger) with Orval code generation

---

## 📦 Project Structure

The project is structured as a monorepo to maximize code sharing and type safety between the client and server.

```text
O2O-main/
├── artifacts/
│   ├── o2o/                # React Native Frontend (Android, iOS, Web)
│   ├── api-server/         # Express Backend API
│   ├── db/                 # Drizzle Database Schema & Migrations
│   └── mockup-sandbox/     # UI Component Sandbox
├── lib/
│   ├── api-client-react/   # Auto-generated React Query hooks & fetchers
│   ├── api-spec/           # OpenAPI YAML specifications & Orval config
│   └── api-zod/            # Shared Zod validation schemas
├── scripts/                # Build and deployment utilities
└── package.json            # Root workspace configuration
```

---

## 🛠️ Local Development Setup

### 1. Prerequisites
- **Node.js**: v20 or higher
- **Package Manager**: pnpm (`npm i -g pnpm`)
- **Database**: PostgreSQL running locally on port 5432
- **Mobile Environment**: Android Studio (for Android) or Xcode (for iOS)

### 2. Install Dependencies
Run the following command at the root of the project to install all dependencies across all workspaces:
```bash
pnpm install
```

### 3. Database Setup
Ensure PostgreSQL is running. Create a database named `o2o`. 
Configure your `.env` file in `artifacts/api-server/.env`:
```env
DATABASE_URL="postgres://postgres:postgres@localhost:5432/o2o"
JWT_SECRET="your_secret_key"
```
Run the Drizzle migrations to generate the tables:
```bash
pnpm --filter @workspace/db run push
```

### 4. Start the Application

You will need to open three separate terminal windows to run the stack.

**Terminal 1: Start the API Server**
```bash
pnpm --filter @workspace/api-server run dev
```

**Terminal 2: Start the Metro Bundler (React Native)**
```bash
pnpm --filter @workspace/o2o run dev --reset-cache
```

**Terminal 3: Launch the Frontend**
Choose your target platform:

*   **Android:** `pnpm --filter @workspace/o2o run android`
*   **Web (Vite):** `pnpm --filter @workspace/o2o run web`
*   **iOS:** `pnpm --filter @workspace/o2o run ios`

*(Note: If building Android for the first time, it is recommended to run `cd artifacts/o2o/android && gradlew clean` first).*

---

## 🔑 Core Features

1. **Robust Authentication**: Secure JWT-based login, signup, and session restoration.
2. **Dynamic Bidding System**: Create product bids, select winning sellers, and manage negotiations.
3. **Real-time Channels & Groups**: Seamless multi-user communication and product discovery.
4. **End-to-End Type Safety**: The backend OpenAPI specs automatically generate the frontend React Query hooks using Orval, ensuring 100% type consistency.
5. **Universal Cross-Platform Code**: The exact same codebase runs natively on Android/iOS via Metro and on the Web via Vite + `react-native-web`.

---

## 🔒 Security & Code Quality
- **Strict TypeScript**: `pnpm run typecheck` enforces rigorous type safety across all boundaries.
- **ESLint**: Modern static analysis rules.
- **Data Protection**: Zero sensitive business data is kept in AsyncStorage; React Query acts purely as a cache layer.

---
*Built with ❤️ for speed, scalability, and seamless cross-platform experiences.*
