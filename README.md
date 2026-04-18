# FeeFlow — Backend Setup Guide

Full-stack Node.js + Express + SQLite backend for the FeeFlow PWA.  
Opens and runs entirely in **VS Code** — no cloud, no Docker, no external DB needed.

---

## Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| Node.js | ≥ 18 | https://nodejs.org |
| npm | comes with Node | — |
| VS Code | any recent | https://code.visualstudio.com |

---

## Quick Start (3 steps)

### 1 — Install dependencies
Open a terminal in the project folder and run:
```bash
npm install
```

### 2 — Seed the database with demo data
```bash
npm run db:seed
```
This creates `data/feeflow.db` and adds a demo admin + 8 members.

### 3 — Start the server
```bash
npm run dev
```
Then open **http://localhost:3000** in your browser.

---

## Demo Login Credentials

| Role   | Phone        | PIN  |
|--------|-------------|------|
| Admin  | 9000000001  | 1234 |
| Member | 9876543210  | 5678 |

---

## Running in VS Code (with debugger)

1. Open the project folder in VS Code: `File → Open Folder`
2. Go to **Run & Debug** (Ctrl+Shift+D)
3. Select **▶ FeeFlow Server** from the dropdown
4. Press **F5** to start with full debugging

Three launch configurations are included:

| Config | What it does |
|--------|-------------|
| ▶ FeeFlow Server | Start server with hot-reload (nodemon) |
| 🌱 Seed Database | Add demo data |
| 🗑 Reset Database | Wipe DB and start fresh |

---

## Project Structure

```
feeflow-backend/
├── public/
│   └── index.html          ← The FeeFlow frontend (served by Express)
├── src/
│   ├── server.js           ← Express app entry point
│   ├── db.js               ← SQLite schema + prepared statements
│   ├── utils/
│   │   └── phone.js        ← Phone normalization (mirrors frontend logic)
│   └── routes/
│       ├── auth.js         ← Register, login, logout, /me
│       ├── institutions.js ← CRUD institutions + members + payments
│       ├── memberships.js  ← Join flow, member-side memberships
│       └── users.js        ← Update profile, country preference
├── scripts/
│   ├── seed.js             ← Populate DB with demo data
│   └── reset-db.js         ← Wipe the database
├── data/
│   └── feeflow.db          ← SQLite database (auto-created on first run)
├── .env                    ← Environment config (PORT, SESSION_SECRET, etc.)
├── .vscode/
│   ├── launch.json         ← VS Code debug configs
│   └── settings.json       ← Editor preferences
└── package.json
```

---

## API Reference

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create new user account |
| POST | `/api/auth/login` | Login with phone + PIN |
| POST | `/api/auth/logout` | End session |
| GET | `/api/auth/me` | Get current user |

### Institutions (admin)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/institutions` | List admin's institutions |
| POST | `/api/institutions` | Create institution |
| DELETE | `/api/institutions/:id` | Delete institution |
| GET | `/api/institutions/:id/members` | List members |
| POST | `/api/institutions/:id/members` | Add single member |
| PUT | `/api/institutions/:id/members/:memberId` | Update member |
| DELETE | `/api/institutions/:id/members/:memberId` | Remove member |
| POST | `/api/institutions/:id/members/bulk` | Bulk import members |
| GET | `/api/institutions/:id/transactions` | List transactions |
| POST | `/api/institutions/:id/members/:memberId/transactions` | Record payment |

### Memberships (member)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/memberships` | List user's memberships |
| POST | `/api/memberships/verify` | Verify phone against invite code |
| POST | `/api/memberships/join` | Join institution |
| PUT | `/api/memberships/:id/profile` | Update member profile |

### User
| Method | Endpoint | Description |
|--------|----------|-------------|
| PUT | `/api/users/me` | Update name, country, profile |

---

## How Frontend ↔ Backend Works

The frontend (`public/index.html`) auto-detects whether it's running on a server:

```js
const API_BASE = window.location.port ? window.location.origin : null;
```

- **With backend** (`http://localhost:3000`): all data goes to the API, session-based auth
- **Standalone** (opened as a plain `.html` file): uses `localStorage`, works offline

This means the same `index.html` works both ways — no build step needed.

---

## Database

SQLite file at `data/feeflow.db`. Tables:

- `users` — all accounts (admin + member)
- `institutions` — admin's institutions
- `members` — admin-managed member records per institution
- `memberships` — member's joined institutions + profile
- `transactions` — payment records

View the database with **DB Browser for SQLite** (free): https://sqlitebrowser.org

---

## Environment Variables (`.env`)

```env
PORT=3000                          # Server port
NODE_ENV=development               # development | production
SESSION_SECRET=change-me           # Random secret for sessions
DB_PATH=./data/feeflow.db         # SQLite file path
DEFAULT_COUNTRY=IN                 # Default phone country
```

---

## npm Scripts

```bash
npm start        # Start server (production)
npm run dev      # Start with auto-restart on file change (nodemon)
npm run db:seed  # Add demo data
npm run db:reset # Wipe database (then run db:seed to repopulate)
```

---

## Recommended VS Code Extensions

- **REST Client** — test API endpoints directly in VS Code (`.http` files)
- **SQLite Viewer** — browse the database without leaving VS Code
- **Prettier** — code formatting
- **ESLint** — catch JS errors

---

## Testing the API in VS Code

Install the **REST Client** extension, then use the included `api-test.http` file:

```http
### Login as admin
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{ "phone": "9000000001", "pin": "1234" }

### Get institutions
GET http://localhost:3000/api/institutions
```

---

*FeeFlow v7 — Privacy-first fee management*

---

## Phase 2 Roadmap

These features are planned but NOT yet implemented. This section is kept here for the next development phase.

### 1 — VPS Sync Coupon / Subscription

**Current state:** VPS Sync is free for 1 year (`vpsSyncStartDate` stored in localStorage). After 1 year, a prompt asks the user to continue or disable.

**Phase 2 implementation:**
- When user clicks "Continue" after free year, prompt for a coupon code
- Backend endpoint: `POST /api/auth/redeem-coupon` — validates coupon, sets `subscription.expiresAt` on User document
- Coupon codes can be generated and distributed by admin (simple shared secret or per-user codes)
- Frontend: `checkVPSSyncExpiry()` already prompts; add `redeemCoupon(code)` function that calls the endpoint and updates `vpsSyncStartDate`
- Store `subscription: { plan, expiresAt }` on User model

### 2 — Push Notifications (FCM)

**Goal:** Admin sends fee reminder → member gets push notification with QR code

**Implementation:**
- Add `@capacitor/push-notifications` plugin
- On app start (native), request permission and register for FCM → `POST /api/users/fcm-token` saves token to User model
- Backend: add `fcmToken` field to User schema
- Admin action: "Send Reminder" calls `POST /api/institutions/:id/members/:memberId/notify`
- Server uses Firebase Admin SDK to send FCM message with: title, body, and image URL (hosted QR image from Payment QR Codes)
- For web: use Web Push API (VAPID keys)

**Dependencies:** `firebase-admin` (server), `@capacitor/push-notifications` (client), `google-services.json` (Android)

### 3 — Session Limits Per Plan

**Current state:** `MAX_SESSIONS = 10` — all sessions stored in User.sessions array.

**Phase 2:** Free plan: 2 active sessions. Prime plan: unlimited.
- Check `user.sessions.length >= SESSION_LIMIT` before recording new session in `recordSession()`
- Return 403 with `{ error: 'session_limit', upgrade: true }` to trigger upgrade prompt

### 4 — Play Store / App Store Publish

**Android (Play Store):**
1. Run `npx cap sync` + Android Studio → Build → Generate Signed Bundle/APK
2. Keystore: `D:/KeyStores/FeeFlow/feeflow_key_store_new.jks`, alias `feeflow`
3. Upload `.aab` to Google Play Console
4. Update `PLAY_STORE_URL` in `public/index.html` once live

**iOS (App Store):**
1. Needs Mac + Xcode; run `npx cap add ios`
2. Bundle ID: `in.iotsoft.feeflow`

### 5 — OTA Update (Android only)

**Current state:** `/api/version` endpoint reads `process.env.APP_VERSION`. APK served at `/feeflow.apk`.

**To release a new version:**
1. Bump `APP_VERSION` in `public/index.html`
2. Build signed APK in Android Studio
3. Copy APK to `public/feeflow.apk` on VPS
4. Set `APP_VERSION=x.y.z` and optionally `APP_CHANGELOG="what's new"` in `.env`
5. PM2 restart: `pm2 restart feeflow-backend`
6. App checks `/api/version` on Settings page → prompts download if newer

**Note:** Android requires "Install unknown apps" permission. Guide user through settings the first time.
