# FeeFlow v3.0 — Architecture & Scaling Roadmap

> **By Jenix** · Privacy-first fee management for institutions
> Built with React 18 + TypeScript + Vite · Express + MongoDB · Zustand · Capacitor (Android)

---

## Table of Contents

1. [Current Architecture](#1-current-architecture)
2. [How the Data Flows Today](#2-how-the-data-flows-today)
3. [Zustand — The Core State Engine](#3-zustand--the-core-state-engine)
4. [Scaling Plan: 0 to 1000+ Admins](#4-scaling-plan-0-to-1000-admins)
5. [Option A — Keep VPS, Enhance It](#5-option-a--keep-vps-enhance-it)
6. [Option B — Migrate to Firebase](#6-option-b--migrate-to-firebase)
7. [Option C — Google Drive as Transaction Store](#7-option-c--google-drive-as-transaction-store)
8. [Recommendation Matrix](#8-recommendation-matrix)
9. [What Never Changes](#9-what-never-changes)
10. [Feature Backlog](#10-feature-backlog)
11. [Environment Variables](#11-environment-variables)
12. [npm Scripts](#12-npm-scripts)
13. [Demo Credentials](#13-demo-credentials)

---

## 1. Current Architecture

```
┌─────────────────────────────────────────────────────┐
│                  CLIENT (React + Zustand)            │
│                                                      │
│  ┌──────────────┐   ┌────────────────────────────┐  │
│  │  Admin UI    │   │  Member UI                 │  │
│  │  Dashboard   │   │  MyFees, JoinFlow          │  │
│  │  Members     │   │  MemberSettings            │  │
│  │  Payments    │   └────────────────────────────┘  │
│  │  Reports     │                                    │
│  │  Settings    │   ┌────────────────────────────┐  │
│  └──────────────┘   │  Zustand Store             │  │
│                     │  useAppStore               │  │
│                     │  useAuthStore              │  │
│                     │  useUIStore                │  │
│                     └──────────┬─────────────────┘  │
│                                │ persist()           │
│                     ┌──────────▼─────────────────┐  │
│                     │  localStorage  ff3         │  │
│                     │  (ALL financial data)      │  │
│                     └────────────────────────────┘  │
└───────────────────────────┬─────────────────────────┘
                            │ /api/* (JWT)
                            ▼
┌─────────────────────────────────────────────────────┐
│              VPS  (feeflow.iotsoft.in :3001)         │
│                                                      │
│  Express.js                                          │
│  ├── /api/auth            register, login, refresh   │
│  ├── /api/auth/me         profile hydration          │
│  ├── /api/auth/sessions   device management          │
│  ├── /api/institutions/publish   member directory    │
│  ├── /api/institutions/lookup/:code  join flow       │
│  └── /api/version         OTA update check          │
│                                                      │
│  MongoDB (Mongoose)                                  │
│  └── users collection                               │
│      id, name, phone, pin_hash, google_id,          │
│      email, role, country, sessions[]               │
└─────────────────────────────────────────────────────┘
```

### What lives where

| Data | Location | Reason |
|---|---|---|
| User identity (name, phone, PIN) | VPS MongoDB | Needed for login from any device |
| Institutions | localStorage only | Admin's private data |
| Members | localStorage only | Admin's private data |
| Transactions | localStorage only | Admin's private data |
| Memberships | localStorage only | Member's private data |
| Institution registry (published) | VPS MongoDB | So members can look up invite codes |
| JWT tokens | localStorage | Short-lived auth |

**Key principle:** The VPS holds *identity* only. All financial data stays on the admin's device.

---

## 2. How the Data Flows Today

### Admin recording a payment

```
Admin taps Rec
  → RecordPaymentModal opens
  → addTransaction()  → Zustand store → persist() → localStorage ff3
  → updateMember()    → Zustand store → persist() → localStorage ff3
  → React re-renders all subscribed components instantly
  (No network call for financial data)
```

### Member viewing their fees

```
MyFees renders
  → reads memberships[] from Zustand
  → cross-references institutions[] + members[] + transactions[]
    by inviteCode → phone match
  → shows full payment history (same-device data)
  (No network call)
```

### Member joining an institution

```
Member enters invite code
  → GET /api/institutions/lookup/:code  (VPS)
  → VPS returns: name, type, plans, adminName
  → addMembership() → Zustand → localStorage
```

---

## 3. Zustand — The Core State Engine

Zustand is **backend-agnostic**. It manages in-memory state and persists to localStorage.
The backend is only used for sync — Zustand does not care which backend is behind `api.ts`.

```
Zustand store
    ↕
localStorage ff3  ← offline source of truth
    ↕
api.ts            ← fetch wrapper (points anywhere: VPS / Firebase / Drive)
```

### Critical pattern — reactive selectors

```ts
// WRONG — no subscription, stays stale after store updates
const { getMembers } = useAppStore();
const members = getMembers(instId);

// CORRECT — subscribes, re-renders on every change
const members = useAppStore(s => s.members[instId] ?? []);
```

Always use selector form when reading `members`, `transactions`, or `memberships`.
Plain function calls (`getMembers`, `getTransactions`) do not create subscriptions.

---

## 4. Scaling Plan: 0 to 1000+ Admins

### Current bottlenecks at scale

| Bottleneck | Threshold | Impact |
|---|---|---|
| Single VPS (1 CPU, 1 GB RAM) | ~200 concurrent users | Slow auth / publish |
| MongoDB on same VPS | ~500 admins | Query latency on institution lookup |
| No CDN for React SPA | ~300 req/s | Slow initial load |
| Single JWT secret | Any | Rotation requires all re-login |
| No rate limiting | Any | Brute-force PIN attacks |

### Phase 1 — 0 to 200 admins (current VPS, tune it)

No infrastructure change needed. Code improvements only:

- [ ] Add `express-rate-limit` on `/api/auth/login` (5 attempts / 15 min)
- [ ] Add `helmet.js` security headers
- [ ] Serve React SPA via nginx (not Express static) — free performance gain
- [ ] Add MongoDB indexes on `users.phone` and `institutions.inviteCode`
- [ ] Add Redis for session cache (reduce MongoDB reads per request)

### Phase 2 — 200 to 500 admins (horizontal + CDN)

- [ ] Put React build (`public/`) on **Cloudflare CDN** (free tier covers this)
  - All static assets cached at edge → 10x faster load globally
- [ ] Move MongoDB to **MongoDB Atlas M10** (dedicated cluster, automatic backups)
  - Current embedded Mongo is single point of failure
- [ ] Add **PM2 cluster mode** on VPS (`pm2 start src/server.js -i max`)
  - Uses all CPU cores, zero-downtime restarts

### Phase 3 — 500 to 1000+ admins (cloud-ready)

- [ ] Move backend to **Cloud Run** (Google) or **Railway** — auto-scales, pay per request
- [ ] MongoDB Atlas M30+ with read replicas
- [ ] Add institution lookup cache with **Upstash Redis** (serverless Redis)
  - Institution records rarely change — cache 10 min — 90% fewer DB reads
- [ ] Background job queue (BullMQ) for:
  - Due-date WhatsApp/SMS reminders
  - Drive sync jobs
  - Bulk report generation

### Phase 4 — Multi-tenant SaaS (1000+ with premium tier)

- [ ] Tenant isolation: each institution gets a scoped API key
- [ ] Subscription billing via **Razorpay Subscriptions**
- [ ] Admin web dashboard (separate from mobile — `admin.feeflow.in`)
- [ ] Audit log: every transaction write is immutable and timestamped
- [ ] GDPR-compliant full data export per admin

---

## 5. Option A — Keep VPS, Enhance It

**Best for: less than 500 admins, tight budget, full data control**

Effort: Low. Only `api.ts` and backend routes change.

```
Current:  api.ts → VPS Express → MongoDB
Enhanced: api.ts → VPS Express (PM2 cluster) → MongoDB Atlas + Redis cache
```

**Cost estimate at 1000 admins:**
- VPS (2 CPU, 4 GB): ~₹1,200/mo
- MongoDB Atlas M10: ~₹3,000/mo
- Cloudflare CDN: Free
- **Total: ~₹4,200/mo**

---

## 6. Option B — Migrate to Firebase

**Best for: 500+ admins, want real-time multi-device sync**

Firebase replaces the VPS entirely. Zustand stays identical.

```
Current:  api.ts → VPS Express → MongoDB
Firebase: api.ts → Firebase SDK → Firestore + Firebase Auth
```

### What changes

| Module | Current | Firebase |
|---|---|---|
| `useAuthStore.ts` | `authFetch('/auth/login')` | `signInWithEmailAndPassword()` |
| `api.ts` | `fetch(API_BASE + path)` | Firestore SDK calls |
| Institution registry | Express route + MongoDB | Firestore `institutions` collection |
| Session management | Custom sessions[] array | Firebase Auth (automatic) |
| OTA version check | `/api/version` | Firestore `config/version` document |

### Real-time sync benefit

```ts
// Firebase Firestore listeners eliminate the Zustand subscription pattern:
onSnapshot(
  collection(db, 'transactions', instId),
  (snap) => {
    useAppStore.setState({
      transactions: {
        ...get().transactions,
        [instId]: snap.docs.map(d => d.data() as Transaction)
      }
    });
  }
);
// All open devices update instantly, no polling needed
```

### Migration steps

1. Create Firebase project — enable Firestore + Auth
2. Replace `src/routes/auth.js` with Firebase Auth SDK calls in `useAuthStore.ts`
3. Replace institution publish/lookup API with Firestore reads/writes
4. Keep `localStorage ff3` as offline cache — Firestore SDK has built-in offline support
5. Remove Express server (or keep only for OTA endpoint)

**Cost estimate at 1000 admins:**
- Firestore: ~$0.06/100K reads — at 50 reads/admin/day = ~₹2,500/mo
- Firebase Auth: Free up to 10K/mo
- Firebase Hosting: Free (10 GB/mo)
- **Total: ~₹2,500/mo** (cheaper than VPS + Atlas at scale)

---

## 7. Option C — Google Drive as Transaction Store

**Best for: admins who want to own their data completely, zero server cost for financial data**

This keeps the local-first model but adds Google Drive as a personal cloud backup and
sync layer for transaction data. Financial data never touches a central server.

### Architecture

```
Admin Device
  Zustand (in-memory)
      ↕ persist()
  localStorage ff3  ← instant offline access
      ↕ driveSync() (background, after every write)
  Google Drive (Admin's own account)
  └── FeeFlow/
      └── {instId}/
          ├── institution.json
          ├── members.json
          └── transactions.json
```

### How it works

**On recording a payment:**
```ts
// After addTransaction() settles in Zustand:
addTransaction: (tx) => {
  set(s => ({ transactions: { ...s.transactions,
    [tx.instId]: [...(s.transactions[tx.instId] ?? []), tx] } }));
  persist();                               // localStorage (instant)
  driveSync.pushTransactions(tx.instId);  // Drive (background, silent)
},
```

**On new device or app reinstall:**
```ts
// Admin signs in with Google → Drive sync restores all their data:
const data = await driveSync.pullAll(instId);
useAppStore.setState({ ...data });
// localStorage populated → app works fully offline again
```

**Conflict resolution (two devices edited simultaneously):**
```
Transactions are append-only by ID — safe to merge
Members are merged by ID — conflicts flagged to admin
Last-write-wins with timestamp for settings
```

### What already exists

`client/src/core/services/driveService.ts` already has:
- Google Auth sign-in via Capacitor (`@codetrix-studio/capacitor-google-auth`)
- File upload to Drive root folder
- Multipart form upload to Drive API v3

### What needs to be built

```
driveService.ts extensions:
  ├── findOrCreateFolder('FeeFlow/{instId}')
  ├── pushTransactions(instId, txns[])
  ├── pushMembers(instId, members[])
  ├── pullAll(instId) → { members, transactions, institution }
  ├── scheduleAutoSync() → debounced push after each write
  └── resolveConflicts(local, remote) → merge + flag duplicates
```

### Trade-offs

| Aspect | Google Drive | Central DB (VPS/Firebase) |
|---|---|---|
| Data ownership | Admin owns 100% | Shared server |
| Cost | Free (15 GB per Google account) | ₹1,000–4,000/mo |
| Multi-device sync | Yes (pull on login) | Yes (real-time) |
| Real-time updates | No (file-based, seconds delay) | Yes (instant) |
| Offline support | Full (localStorage) | Full (Firestore offline) |
| Conflict handling | Custom merge logic needed | Handled by DB |
| Admin trust | Maximum — data in their own Drive | Must trust server |

### When to choose Drive sync

- Admin explicitly does not want financial data on any server
- Small institution (less than 500 members) where real-time sync is not critical
- Admin already uses Google Workspace
- Zero recurring server cost is a hard requirement

---

## 8. Recommendation Matrix

| Situation | Recommendation |
|---|---|
| Today (less than 100 admins) | Current VPS — no change needed |
| 100–500 admins | Option A — PM2 + Atlas + Cloudflare CDN |
| 500–1000 admins | Option B — Firebase (real-time, auto-scale) |
| Admin wants data sovereignty | Option C — Google Drive alongside any option |
| 1000+ admins, SaaS model | Firebase + Razorpay billing + Cloud Run |
| Data must stay in India | VPS in Mumbai (DigitalOcean BLR1) + Atlas Mumbai cluster |

Options A, B, C are **not mutually exclusive.**
Example: Firebase for identity + institution registry (B) with Google Drive for
transaction storage per admin (C) — VPS kept only for the OTA version endpoint.

---

## 9. What Never Changes

Regardless of which scaling path is chosen, these parts remain identical:

| File / Module | Role |
|---|---|
| All React components | UI — completely backend-agnostic |
| `useAppStore.ts` | State shape and reducers — unchanged |
| `localStorage ff3` | Offline cache — always the instant read layer |
| `feeRules.ts` | Balance, grace period, auto-advance logic |
| `institutionTypes.ts` | All 17 institution types and identifiers |
| `pdfService.ts` | Receipt PDF generation — local, no server |
| `excelService.ts` | Excel import/export — local, no server |
| Capacitor | Android packaging — unchanged |
| The local-first model | App works fully offline; sync is enhancement |

The only files that change between scaling options are **`api.ts`** and **`useAuthStore.ts`**.

---

## 10. Feature Backlog

### Ready to enable (services already implemented)

- [ ] **PDF receipts** — `core/services/pdfService.ts` is ready
  - Wire into Payments page: "Download Receipt" button per transaction
  - Wire into member-side MyFees: member can download their own receipt
- [ ] **Excel export** — `core/services/excelService.ts` is ready
  - Wire into Members page: "Export Members" button
  - Wire into Reports page: "Export Transactions" button
- [ ] **Excel import (bulk members)** — `excelService.ts` is ready
  - Wire into Members page: "Import from Excel" button with column mapping modal
- [ ] **WhatsApp receipt share** — Use `navigator.share()` (Web Share API)
  - On mobile: share PDF receipt directly to WhatsApp contact
  - Trigger from Payments page after recording, or from member card
- [ ] **Google Drive backup** — `driveService.ts` foundation ready
  - Extend with per-institution folder structure (see Option C above)
  - Wire into Settings: "Sync to Drive" button per institution

### Planned

- [ ] **Attendance IoT module** — `modules/attendance/` (for future hardware)
- [ ] **Multi-admin per institution** — shared invite with role-based access
- [ ] **Partial payment installment plan** — split fee into fixed installments
- [ ] **Late fee auto-calculation** — penalty after grace period elapses
- [ ] **Annual report PDF** — year summary per institution for accounting
- [ ] **WhatsApp/SMS due reminders** — server-side job, trigger before nextDue

---

## 11. Environment Variables

```env
# Backend (.env)
MONGO_URI=
JWT_SECRET=
JWT_REFRESH_SECRET=
GOOGLE_CLIENT_ID=
PORT=3001
DEFAULT_COUNTRY=IN
APP_VERSION=1.0.0
APP_CHANGELOG=

# Frontend (vite.config or client/.env)
VITE_API_BASE=https://feeflow.iotsoft.in
VITE_GOOGLE_CLIENT_ID=
```

---

## 12. npm Scripts

```bash
npm run dev            # Express backend (nodemon, port 3001)
npm run client:dev     # Vite dev server (port 5173, proxies /api to 3001)
npm run client:build   # Build React to public/
npm run db:seed        # Seed demo users in MongoDB
npx cap sync           # Sync web build to Android (run after client:build)
npx cap open android   # Open Android Studio
```

---

## 13. Demo Credentials

| Role | Phone | PIN |
|---|---|---|
| Admin | 9000000001 | 1234 |
| Member | 9876543210 | 5678 |

---

*Last updated: April 2026 — FeeFlow v3.0*

- Data Download/upload EXCEL JSON , GDRIVE BACKUP , Yearly Monthly Statements 
- Expenditure Toggle on in Society , so that expense can be written there , expense type like , Employee Salary , Genitor Staff , Swiper , Cleaning , Electrician, Plumber , Gardner , Custom , etc.  
