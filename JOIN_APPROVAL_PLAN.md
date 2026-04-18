# Member Self-Join with Admin Approval — Implementation Plan

Status: **Pending confirmation** — VPS routes + client changes both required.
Confirm to proceed: implement all sections below in one go.

---

## Overview

Replace the current instant-join flow with a request → approval workflow.
Member submits a join request. Admin sees it, approves / holds / rejects with a reason.

---

## 1. VPS — New MongoDB Model

**File:** `src/models/JoinRequest.js`

```js
const JoinRequestSchema = new mongoose.Schema({
  inviteCode:  { type: String, required: true, index: true },
  name:        { type: String, required: true },
  phone:       { type: String, required: true },
  plan:        { type: String, default: '' },
  status:      { type: String, enum: ['pending','approved','rejected','hold'], default: 'pending' },
  reason:      { type: String, default: '' },   // admin's reason for hold/reject
  createdAt:   { type: Date, default: Date.now },
  resolvedAt:  { type: Date },
});
```

---

## 2. VPS — New Routes

**File:** `src/routes/joinRequests.js`

```
POST   /api/join-requests
  body: { inviteCode, name, phone, plan }
  → creates JoinRequest, returns { id, status: 'pending' }
  → no auth required (member may not be logged in)
  → validates inviteCode exists in published institutions

GET    /api/join-requests/:inviteCode
  → auth required (admin JWT)
  → returns all requests for that invite code
  → sorted by createdAt desc

PATCH  /api/join-requests/:id
  body: { status: 'approved'|'rejected'|'hold', reason?: string }
  → auth required (admin JWT)
  → updates status + resolvedAt

GET    /api/join-requests/status/:phone/:inviteCode
  → no auth (member polls this)
  → returns { status, reason } for their request
```

Mount in `src/server.js`:
```js
app.use('/api/join-requests', require('./routes/joinRequests'));
```

---

## 3. Client — Member Side (JoinFlow.tsx)

### Step changes

```
Current:  code → plan → confirm → instantly joined
New:      code → plan → name+phone → "Request sent" → poll status
```

### New Step: `'request'`

After picking a plan, show a simple form:
- Name (pre-filled if logged in)
- Phone (pre-filled if logged in)
- "Send Join Request" button

On submit:
```ts
POST /api/join-requests { inviteCode, name, phone, plan }
→ save { requestId, inviteCode, status: 'pending' } in localStorage
→ setStep('status')
```

### New Step: `'status'`

Shows a status card. Member taps "Check status" to re-poll:
```ts
GET /api/join-requests/status/:phone/:inviteCode
```

| API status | Member sees |
|---|---|
| `pending` | ⏳ "Your request is under review. Check back soon." |
| `approved` | ✅ "You're approved! Tap below to activate." → calls addMembership() |
| `rejected` | ❌ "Not approved — [reason]" |
| `hold` | ⏸ "On hold — [reason]. Contact your admin." |

On `approved`: call `addMembership()` with the plan details → member enters the app normally.

### Backward compatibility

Keep the "instant join" path for institutions that have NOT enabled approval mode.
Add a per-institution toggle in Settings: **"Require approval for new members"** (default OFF).

---

## 4. Client — Admin Side

### Members page badge

```ts
// Poll pending requests count on mount
GET /api/join-requests/:inviteCode
→ filter status === 'pending'
→ show badge on Members tab nav item
```

### New "Requests" section in Members page

Above the member list, when pending requests exist:

```
┌─ Pending Requests (2) ────────────────────────────────┐
│  Rahul Sharma  · 9876543210  · 2 BHK plan             │
│  [Approve]  [Hold ▾]  [Reject ▾]                      │
│                                                       │
│  Priya Patel   · 9123456789  · 3 BHK plan             │
│  [Approve]  [Hold ▾]  [Reject ▾]                      │
└───────────────────────────────────────────────────────┘
```

**Approve** → calls `PATCH /api/join-requests/:id { status: 'approved' }`
            + immediately calls `addMember()` to create the member locally

**Hold / Reject** → opens a small input asking for reason (optional but encouraged)
                  → calls `PATCH /api/join-requests/:id { status, reason }`

### Settings toggle per institution

In `Settings/index.tsx` inside the institution's Fee Rules card:

```tsx
<div className="tgl-row">
  <div>
    <div>Require Approval for New Members</div>
    <div>Members must request to join; you approve or reject</div>
  </div>
  <label className="tgl-switch">
    <input type="checkbox"
      checked={inst.requireApproval === true}
      onChange={e => updateInstitution(inst.id, { requireApproval: e.target.checked })}/>
    <span className="tgl-track"/>
  </label>
</div>
```

Add `requireApproval?: boolean` to the `Institution` type.

When `requireApproval` is false (default): JoinFlow works as before (instant join).
When `requireApproval` is true: JoinFlow sends a request instead.

The VPS `/api/institutions/lookup/:code` response should include `requireApproval` so the
member's app knows which flow to show before they even pick a plan.

---

## 5. Types to add

**`Institution`:**
```ts
requireApproval?: boolean;
```

**New type `JoinRequest`:**
```ts
export interface JoinRequest {
  id: string;
  inviteCode: string;
  name: string;
  phone: string;
  plan: string;
  status: 'pending' | 'approved' | 'rejected' | 'hold';
  reason?: string;
  createdAt: string;
}
```

---

## 6. Files to create / modify

| File | Change |
|---|---|
| `src/models/JoinRequest.js` | **Create** |
| `src/routes/joinRequests.js` | **Create** |
| `src/server.js` | Mount new route |
| `src/routes/institutions.js` | Include `requireApproval` in lookup response |
| `client/src/core/types/index.ts` | Add `requireApproval` to Institution, add JoinRequest type |
| `client/src/modules/member/JoinFlow.tsx` | Add request/status steps |
| `client/src/modules/admin/Members/index.tsx` | Add pending requests section |
| `client/src/modules/admin/Settings/index.tsx` | Add requireApproval toggle |
| `client/src/core/services/api.ts` | No change needed |

---

## 7. Effort estimate

- VPS routes + model: ~2 hours
- Member JoinFlow changes: ~1.5 hours
- Admin Members page requests UI: ~1.5 hours
- Settings toggle: ~30 min
- Testing end-to-end: ~1 hour

**Total: ~6–7 hours of focused development**

---

Confirm to implement all of the above.
