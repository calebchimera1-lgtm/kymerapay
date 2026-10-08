# KESPAY — Architecture Plan (Pre-Phase 1)

> **Status:** Proposed — awaiting approval before Phase 1 implementation.
> **Product name:** `KESPAY` (temporary; centralised in brand config, see §3.9).
> **Environment:** **DEMO MODE — NO REAL MONEY.** Demo environment. No real money is transferred.

This document covers the specification analysis, how ambiguities are resolved, the
final architecture, the entity-relationship design, the folder structure, the
implementation roadmap and the dependency list.

---

## 1. Specification Analysis

The spec describes a P2P + merchant wallet that runs entirely on simulated KES in V1,
with an architecture that can later take real payment rails. The hard requirements are:

| Area | Non-negotiables |
|---|---|
| Money | No floats. `NUMERIC`. Balances change only through an immutable, auditable ledger. Atomic DB transactions. Idempotency. Server-side computation only. |
| Safety | No real providers. Persistent "DEMO MODE — NO REAL MONEY" indicator. No claim of being licensed. |
| Security | Hashed passwords + PINs, JWT, RBAC, Zod, rate limiting, Helmet, CORS, lockout, audit logs, no leaked internals. |
| Privacy | Private by default. Feed never exposes balances, phones or emails. |
| UX | Mobile-first, light/dark, loading/error/empty/success states on every major page. |
| Extensibility | Payment-provider adapters, OTP-ready auth, easy rebrand. |

---

## 2. Conflicts & Ambiguities — and How They're Resolved

| # | Ambiguity / Conflict | Decision |
|---|---|---|
| 1 | **"Manage demo balances" (admin) vs. "never modify a balance without a transaction".** | Admin never edits a balance. Admin funding/debiting creates an `ADJUSTMENT` transaction against a **System Treasury wallet** with double-entry ledger lines and an audit log entry. |
| 2 | **Where does seed/demo money come from?** A pure ledger needs a counter-party. | A non-login **SYSTEM** user owns a `TREASURY` wallet that may go negative (it represents simulated money issued). Seed balances are `FUNDING` transactions from the treasury, so `SUM(all ledger) = 0` always holds. |
| 3 | **Balance column vs. ledger as source of truth.** | Ledger is the source of truth. `Wallet.balance` is a cached projection updated **in the same DB transaction** as the ledger lines, with `balanceAfter` stored per entry. A reconciliation check (admin + test) verifies `balance == SUM(entries)`. DB `CHECK (balance >= 0)` on non-treasury wallets. |
| 4 | **Business = separate account or profile attached to a person?** Spec gives businesses their own username, email, phone. | A business is its own `User` with `role = BUSINESS` plus a 1:1 `BusinessProfile`. One wallet per user. Usernames share one namespace (`@caleb254`, `@visiblegeneral`). Multi-staff businesses (`BusinessMember`) are a future extension. |
| 5 | **Roles vs. account type.** | Single `Role` enum: `USER`, `BUSINESS`, `ADMIN`, `SYSTEM`. Admins have **no wallet** and cannot move money (separation of duties). `SYSTEM` cannot log in. |
| 6 | **"Freeze" vs. "Suspend".** | Same thing: `UserStatus = ACTIVE | SUSPENDED`. Suspension revokes sessions, blocks login, and makes the account unable to send **or** receive (`ACCOUNT_SUSPENDED` / `RECIPIENT_UNAVAILABLE`). Reactivation restores it. Both audited. |
| 7 | **Where is the PIN used?** Spec collects it but never says. | PIN confirms every outgoing money movement (send, pay request, business pay, split share). Wrong PIN ×5 → 15‑min transaction lock. Password lockout is separate (5 failures → 15 min). |
| 8 | **JWT storage vs. XSS/CSRF.** | Short-lived **access token** (15 min) kept in memory (Zustand), sent as `Authorization: Bearer`. **Refresh token** in `httpOnly; Secure; SameSite=Strict` cookie scoped to `/api/auth`, rotated on every use, stored **hashed** in `Session`; reuse of a rotated token revokes the whole session family. Cookie endpoints additionally require a custom header + Origin check (CSRF defence). |
| 9 | **QR payload exposure.** `PAY:@caleb254` leaks identity and is forgeable. | QR encodes an opaque, unguessable code: `kespay://pay/<code>` (prefix from brand config). `GET /api/qr/resolve/:code` returns only a public profile (display name, username, avatar, verified-business flag). **Scanning never pays** — it opens the confirm screen. Businesses can also generate **dynamic QRs** with a fixed amount + expiry. |
| 10 | **`POST /api/qr/generate` vs. "every user has a QR".** | Each user gets a static QR at registration. `generate` creates a dynamic QR (business) or rotates the static one (revoking the old). `GET /api/qr/me` returns the current one. |
| 11 | **`/businesses/:username` (GET) vs. `/businesses/:id/pay` (POST).** | Keep both as specified: read by username (human-friendly), pay by UUID (stable, from QR resolve). Business pay reuses the transfer engine with type `BUSINESS_PAYMENT`. |
| 12 | **Split bill: does the creator pay themselves? Rounding?** | Creator is a participant; their share is auto-marked `SETTLED` (no self-request). Equal splits allocate leftover cents deterministically (e.g. 1,000 ÷ 3 → 333.34 / 333.33 / 333.33). Custom splits allowed; must sum exactly to total. Each other participant receives a linked `PaymentRequest`. |
| 13 | **`EXPIRED` requests need a mechanism.** | `expiresAt` (default 7 days, configurable). Expiry is enforced at read/pay time (authoritative) plus an in-process periodic sweep for notifications. No queue infra in V1. |
| 14 | **Feed: spec example shows amounts but also says "don't expose sensitive financial info".** | Feed is opt-in. Transaction `visibility = PRIVATE (default) | FRIENDS`. Effective visibility is the **most restrictive** of sender and recipient preferences. **Amounts are shown only to the two participants**; friends see parties, note and time. Business payments and admin adjustments never appear. "Friends" = mutual contacts. *(Overridable if you want amounts visible.)* |
| 15 | **Notifications transport.** | In-app notification centre, polled every 30 s plus refetch on focus. SSE/WebSocket and SMS/push are later adapters. |
| 16 | **"Logged in from a new device".** | `Session` stores a hashed device fingerprint (UA + client-generated device ID). A first-seen fingerprint triggers a security notification. |
| 17 | **OTP "prepared for future".** | `OtpChallenge` model + `OtpProvider` interface + `ConsoleOtpProvider` (dev logs only). Not enforced in V1 flows; wiring points documented. |
| 18 | **Photo/logo uploads.** | `StorageProvider` interface with a local-disk implementation (MIME sniffing, 2 MB limit, re-encoded filenames). S3-compatible adapter later. |
| 19 | **Amount limits** (not specified). | Configurable: min KSh 1.00, max KSh 150,000 per transaction, KSh 300,000 per day. 2 decimal places, enforced server-side. |
| 20 | **Timezone.** | Store UTC (`timestamptz`); display and "Today's sales" in `Africa/Nairobi`. |
| 21 | **Phone formats.** | Accept `07…`, `01…`, `7…`, `254…`, `+254…`; validate with libphonenumber; store E.164 `+2547XXXXXXXX`. Never shown to other users. |
| 22 | **Username rules.** | 3–20 chars, `[a-z0-9_]`, case-insensitive unique, stored without `@`, reserved words blocked (`admin`, `kespay`, `support`, `system`…). |
| 23 | **Transaction reference format.** Spec shows `TXN-8F7A29` (6 chars → collision-prone). | `TXN-` + 10 Crockford base32 chars from a CSPRNG, unique-indexed. |
| 24 | **Idempotency semantics.** | `Idempotency-Key` header **required** on all money-moving POSTs. Stored per `(userId, key)` with a request hash. Same key + same body → original response replayed. Same key + different body → `422 IDEMPOTENCY_KEY_REUSED`. Concurrent in-flight duplicate → `409 REQUEST_IN_PROGRESS`. Keys retained 24 h. |
| 25 | **Race conditions / deadlocks.** | Inside a `SERIALIZABLE`-safe Prisma interactive transaction, wallets are locked with `SELECT … FOR UPDATE` **in ascending wallet-id order** to prevent deadlocks; balance check happens after the lock. Serialization failures retried (bounded). |
| 26 | **"Complete file after each phase" in chat vs. very large phases.** | All code is committed to the branch. Each phase report lists every created/changed file and includes complete contents of the key files; the rest are on the branch in full. *(Tell me if you want every file pasted inline regardless of size.)* |
| 27 | **Receipt download.** | Dedicated printable receipt route with print stylesheet (Save as PDF via browser). Server-side PDF generation deferred to avoid a heavy dependency. Receipt is fetched from the server, never built from client state. |
| 28 | **Shared code between client & server** vs. "keep clearly separated" + "no duplicated logic". | npm workspaces with a small `shared/` package for Zod schemas, enums, error codes and money formatting only. No runtime coupling beyond that. |
| 29 | **Data fetching state.** Spec lists Axios + Zustand. | Recommend adding **TanStack Query** on top of Axios for caching, loading/error states and refetch-on-focus (it removes a lot of hand-rolled state). Zustand keeps auth + UI prefs. *(Can drop if you'd rather not add it.)* |
| 30 | **Rate-limit store / scaling.** | In-memory store for single-instance V1; Redis store is a drop-in later. Documented as a production consideration. |

---

## 3. Final Architecture

### 3.1 High-level

```
┌──────────────────────────────┐        HTTPS (JSON)        ┌─────────────────────────────────────────┐
│ client (React + Vite + TS)   │ ─────────────────────────▶ │ server (Express + TS)                   │
│                              │  Bearer access token       │                                         │
│ pages → hooks → services     │  httpOnly refresh cookie   │ routes → middleware → controllers       │
│ (TanStack Query + Axios)     │ ◀───────────────────────── │        → services → repositories        │
│ Zustand: auth, theme         │  { success, data | error } │        → Prisma → PostgreSQL            │
└──────────────────────────────┘                            │                                         │
                                                            │ services/ledger  ← the ONLY code that   │
                                                            │                    changes balances     │
                                                            │ providers/payment (DemoProvider only)   │
                                                            │ providers/otp     (ConsoleOtpProvider)  │
                                                            │ providers/storage (LocalStorage)        │
                                                            └─────────────────────────────────────────┘
```

### 3.2 Backend layering

| Layer | Responsibility | Rules |
|---|---|---|
| `routes/` | URL → middleware chain → controller | No logic. |
| `middleware/` | auth, `requireRole`, `validate(zod)`, `idempotency`, rate limits, request ID, error handler | |
| `controllers/` | Parse validated input, call a service, shape response | No Prisma access. |
| `services/` | Business rules, orchestration, DB transactions | All money math (decimal.js). |
| `repositories/` | Prisma queries, row locking | Accept a `tx` client so they compose inside transactions. |
| `validators/` | Zod schemas (re-export from `shared` where common) | |
| `providers/` | External-world adapters behind interfaces | V1: demo/console/local only. |

### 3.3 The money engine (core design)

`LedgerService.post()` is the **single** function that can move value:

```
post({ type, debitWalletId, creditWalletId, amount, initiatorId, idempotencyKey, meta })
  BEGIN
    lock wallets FOR UPDATE ordered by id
    assert both ACTIVE, owners ACTIVE, currency match
    assert debit.balance >= amount (unless TREASURY)
    insert Transaction (ref TXN-…, status COMPLETED)
    insert LedgerEntry DEBIT  (debit wallet,  amount, balanceAfter)
    insert LedgerEntry CREDIT (credit wallet, amount, balanceAfter)
    update both wallet balances
    insert AuditLog, Notifications
  COMMIT
```

Transfers, request payments, split shares, business payments and admin adjustments are thin
services that validate their own rules and then call `post()`.

Immutability is enforced in **two** places: the repository exposes no update/delete for
`LedgerEntry`, and a migration adds PostgreSQL triggers that reject `UPDATE`/`DELETE` on
`ledger_entries` and on financial columns of `transactions`. Corrections are new
`REVERSAL`/`ADJUSTMENT` transactions.

### 3.4 Payment-provider abstraction

```ts
interface PaymentProvider {
  readonly id: ProviderId;                // 'demo' | future 'mpesa' | 'bank' | 'card'
  initializePayment(input: InitPaymentInput): Promise<ProviderPaymentResult>;
  verifyPayment(providerRef: string): Promise<ProviderPaymentResult>;
  getTransactionStatus(providerRef: string): Promise<ProviderStatus>;
  refundPayment(input: RefundInput): Promise<ProviderPaymentResult>;
}
```

V1 registers only `DemoProvider` (resolves instantly, used for admin demo funding).
`Transaction` carries nullable `provider`/`providerRef` columns so external rails slot in
later without schema surgery. Provider callbacks (e.g. STK push results) would land on a
future `/api/webhooks/:provider` route and post through the same ledger.

### 3.5 Auth flow

```
register → argon2id(password), argon2id(pin) → User + Wallet + static QR (one DB tx)
login(identifier = email | phone | username, password)
  → lockout check → verify → Session(hashed refresh, device fp) → access JWT + refresh cookie
refresh → rotate refresh token (reuse detection) → new access JWT
logout → revoke session
```

JWT claims: `sub`, `role`, `sid`, `ver` (token version bumped on suspend/password change).
Role and status are re-checked from the DB on sensitive routes — never trusted from the client.

### 3.6 API response contract

```json
{ "success": true,  "data": { ... }, "meta": { "nextCursor": "..." } }
{ "success": false, "error": { "code": "INSUFFICIENT_BALANCE", "message": "Insufficient wallet balance.", "requestId": "..." } }
```

Money is always serialised as a **string** with 2 dp (`"1500.00"`), plus `currency: "KES"`.
Pagination is cursor-based. Errors map from a typed `AppError` hierarchy; Prisma/unknown errors
become `INTERNAL_ERROR` with no details, logged server-side with the request ID.

### 3.7 API surface (V1)

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/register`, `/register/business`, `/login`, `/refresh`, `/logout`; `POST /api/auth/pin/verify` |
| Users | `GET/PATCH /api/users/me`, `POST /api/users/me/avatar`, `PATCH /api/users/me/privacy`, `PATCH /api/users/me/pin`, `GET /api/users/search?q=`, `GET /api/users/:username` (public profile) |
| Wallet | `GET /api/wallet`, `GET /api/wallet/summary` (spend/receive stats) |
| Transfers | `POST /api/transfers` 🔑 |
| Transactions | `GET /api/transactions?filter=all\|sent\|received\|requests\|business`, `GET /api/transactions/:reference`, `GET /api/transactions/:reference/receipt` |
| Requests | `POST /api/payment-requests`, `GET /api/payment-requests?direction=incoming\|outgoing`, `POST /:id/pay` 🔑, `/:id/decline`, `/:id/cancel` |
| Split bills | `POST /api/bill-splits`, `GET /api/bill-splits`, `GET /:id`, `POST /:id/cancel` |
| QR | `GET /api/qr/me`, `POST /api/qr/generate`, `GET /api/qr/resolve/:code` |
| Businesses | `POST /api/businesses` (upgrade/profile), `GET /api/businesses/:username`, `PATCH /api/businesses/me`, `POST /api/businesses/:id/pay` 🔑, `GET /api/businesses/me/dashboard`, `/me/analytics`, `/me/customers` |
| Contacts & feed | `GET/POST/DELETE /api/contacts`, `GET /api/feed` |
| Notifications | `GET /api/notifications`, `GET /unread-count`, `PATCH /:id/read`, `PATCH /read-all` |
| Admin | `GET /api/admin/stats`, `/users`, `/users/:id`, `POST /users/:id/suspend`, `/reactivate`, `GET /businesses`, `/transactions`, `/audit-logs`, `POST /wallets/:id/adjust` 🔑, `GET /reconciliation` |
| System | `GET /api/health`, `GET /api/config/public` (brand, demo flag, limits) |

🔑 = requires `Idempotency-Key` + PIN.

### 3.8 Frontend architecture

- **Routing:** React Router with `AuthLayout`, `AppLayout` (sidebar desktop / bottom nav mobile), `BusinessLayout`, `AdminLayout`; route guards by role.
- **Data:** `services/*.ts` (typed Axios calls) → `hooks/use*.ts` (TanStack Query) → pages. Axios interceptor refreshes the access token once on 401 and retries.
- **State:** Zustand `authStore` (access token in memory, user), `uiStore` (theme, persisted).
- **Components:** primitives (`Button`, `Card`, `Input`, `AmountInput`, `Avatar`, `Badge`, `Sheet/Modal`, `Skeleton`, `EmptyState`, `ErrorState`) + domain components (`BalanceCard`, `TransactionRow`, `ConfirmPaymentSheet`, `PinPad`, `QrCard`, `QrScanner`, `ReceiptView`, `DemoBanner`).
- **Every money action:** form → server-side preview (recipient resolved) → confirmation sheet ("Send KSh 1,500 to @john254?") → PIN → submit with a client-generated idempotency key that is **reused** on retry → success/receipt screen.
- **Demo banner:** fixed, non-dismissible "DEMO MODE — NO REAL MONEY" strip on every page incl. auth and receipts (also printed on receipts).

### 3.9 Design system & branding

- `shared/src/brand.ts` + `client/src/config/brand.ts`: name, tagline, QR scheme, colours, logo path, legal disclaimer. Rename = edit one file + env `APP_NAME`.
- Colour tokens as CSS variables (Tailwind theme reads them) — light & dark.
  - Primary: deep **savanna green** (`#0F6B4F`-range) for trust; accent: warm **amber/sunset** (`#E8A33D`) used sparingly; neutrals: warm stone greys; semantic success/warning/danger/info.
  - Subtle Kenyan identity via a geometric pattern motif (inspired by beadwork) on the balance card and empty states — no flags, no stock clichés, no heavy gradients.
- Type: Inter (UI) + tabular numerals for amounts. Large balance display, 16–20 px rounded cards, 150–200 ms motion with `prefers-reduced-motion` respected. WCAG AA contrast, visible focus rings, ARIA on all interactive elements.

### 3.10 Cross-cutting

- Logging: `pino` (JSON, request ID, redaction of `password`, `pin`, tokens, `authorization`, `cookie`).
- Config: Zod-validated env at boot; app refuses to start with missing/weak `JWT_SECRET`, or if `DEMO_MODE` is anything but `true`.
- Docker: `docker-compose.yml` with `postgres`, `server`, `client` (+ `postgres-test` profile for tests).

---

## 4. Entity-Relationship Design

```
User 1───1 Wallet 1───* LedgerEntry *───1 Transaction
 │  1───0..1 BusinessProfile                 │  *───1 Wallet (from)   *───1 Wallet (to)
 │  1───* QrCode                             │  0..1 ──1 PaymentRequest (paid by)
 │  1───* Session                            │  0..1 ──1 IdempotencyKey
 │  1───* Notification
 │  1───* Contact (owner) *───1 User (contact)
 │  1───* PaymentRequest (requester / payer)
 │  1───* BillSplit (creator) 1───* BillParticipant *───1 User
 │                                             BillParticipant 0..1───1 PaymentRequest
 │  1───* AuditLog (actor)
 │  1───* OtpChallenge
```

### 4.1 Enums

`Role(USER, BUSINESS, ADMIN, SYSTEM)` · `UserStatus(ACTIVE, SUSPENDED)` ·
`WalletType(PERSONAL, BUSINESS, TREASURY)` · `WalletStatus(ACTIVE, FROZEN)` ·
`TransactionType(TRANSFER, REQUEST_PAYMENT, SPLIT_PAYMENT, BUSINESS_PAYMENT, FUNDING, ADJUSTMENT, REVERSAL)` ·
`TransactionStatus(PENDING, COMPLETED, FAILED, REVERSED)` · `EntryDirection(DEBIT, CREDIT)` ·
`Visibility(PRIVATE, FRIENDS)` · `PaymentRequestStatus(PENDING, PAID, DECLINED, EXPIRED, CANCELLED)` ·
`BillSplitStatus(OPEN, SETTLED, CANCELLED)` · `ParticipantStatus(PENDING, PAID, DECLINED, SETTLED_SELF)` ·
`QrType(STATIC, DYNAMIC)` · `NotificationType(MONEY_RECEIVED, MONEY_SENT, REQUEST_RECEIVED, REQUEST_PAID, REQUEST_DECLINED, SPLIT_CREATED, SECURITY, SYSTEM)` ·
`OtpPurpose(PHONE_VERIFY, LOGIN, PIN_RESET)`

### 4.2 Models (key fields — all IDs UUID, all have `createdAt`/`updatedAt` unless immutable)

| Model | Fields | Constraints / Indexes |
|---|---|---|
| **User** | id, fullName, username, email, phone, passwordHash, pinHash, role, status, avatarUrl, isDemo, defaultVisibility, failedLoginCount, lockedUntil, failedPinCount, pinLockedUntil, tokenVersion, lastLoginAt | unique(username), unique(email), unique(phone); idx(role, status) |
| **Wallet** | id, userId, type, currency(`KES`), balance `Decimal(18,2)`, status | unique(userId); CHECK balance ≥ 0 when type ≠ TREASURY |
| **Transaction** *(immutable financials)* | id, reference, type, status, amount `Decimal(18,2)`, currency, fromWalletId, toWalletId, initiatorId, note (≤140), visibility, paymentRequestId?, billSplitId?, provider?, providerRef?, reversalOfId?, metadata(jsonb), completedAt | unique(reference); unique(paymentRequestId); idx(fromWalletId, createdAt desc); idx(toWalletId, createdAt desc); idx(type, createdAt); CHECK amount > 0 |
| **LedgerEntry** *(append-only)* | id, transactionId, walletId, direction, amount, balanceAfter, createdAt | idx(walletId, createdAt); idx(transactionId); trigger blocks UPDATE/DELETE |
| **IdempotencyKey** | id, userId, key, endpoint, requestHash, status(IN_PROGRESS/COMPLETED), responseCode, responseBody(jsonb), transactionId?, expiresAt | unique(userId, key); idx(expiresAt) |
| **PaymentRequest** | id, requesterId, payerId, amount, currency, note, status, expiresAt, billParticipantId?, respondedAt | idx(payerId, status); idx(requesterId, status); idx(status, expiresAt) |
| **BillSplit** | id, creatorId, title, totalAmount, currency, splitMethod(EQUAL/CUSTOM), status | idx(creatorId, createdAt) |
| **BillParticipant** | id, billSplitId, userId, amountOwed, amountPaid, status | unique(billSplitId, userId); CHECK amountPaid ≤ amountOwed |
| **BusinessProfile** | id, userId, businessName, category, location, description, logoUrl, registrationNumber? (placeholder), isVerified(false) | unique(userId); idx(category) |
| **QrCode** | id, userId, code, type, amount?, note?, expiresAt?, isActive, scanCount | unique(code); idx(userId, isActive) |
| **Notification** | id, userId, type, title, body, data(jsonb), readAt? | idx(userId, readAt, createdAt desc) |
| **Contact** | id, ownerId, contactId, nickname? | unique(ownerId, contactId); CHECK owner ≠ contact |
| **AuditLog** *(append-only)* | id, actorId?, action, entityType, entityId, ip, userAgent, metadata(jsonb), createdAt | idx(actorId, createdAt); idx(entityType, entityId); idx(action, createdAt) |
| **Session** | id, userId, refreshTokenHash, familyId, deviceFingerprintHash, userAgent, ip, expiresAt, revokedAt?, replacedById? | unique(refreshTokenHash); idx(userId, revokedAt) |
| **OtpChallenge** | id, userId, purpose, codeHash, attempts, expiresAt, consumedAt? | idx(userId, purpose) |

All money columns are `Decimal(18,2)`; table names `snake_case` via `@@map`.

---

## 5. Project Folder Structure

```
/kymerapay (repo root = project root)
├── client/
│   ├── public/
│   ├── src/
│   │   ├── assets/            # logo, pattern SVGs
│   │   ├── components/
│   │   │   ├── ui/            # Button, Card, Input, Modal, Skeleton, Badge…
│   │   │   ├── feedback/      # EmptyState, ErrorState, LoadingState, DemoBanner
│   │   │   ├── wallet/        # BalanceCard, QuickActions, AmountInput
│   │   │   ├── payments/      # ConfirmPaymentSheet, PinPad, RecipientPicker
│   │   │   ├── transactions/  # TransactionRow, TransactionList, ReceiptView
│   │   │   ├── qr/            # QrCard, QrScanner
│   │   │   └── charts/
│   │   ├── config/            # brand.ts, env.ts
│   │   ├── hooks/             # useAuth, useWallet, useTransactions…
│   │   ├── layouts/           # AuthLayout, AppLayout, BusinessLayout, AdminLayout
│   │   ├── pages/
│   │   │   ├── auth/  dashboard/  wallet/  send/  request/  split/  scan/
│   │   │   ├── transactions/  receipts/  contacts/  notifications/  profile/  settings/
│   │   │   ├── business/      # dashboard, payments, customers, analytics, profile
│   │   │   └── admin/         # overview, users, businesses, transactions, audit
│   │   ├── router/            # routes + guards
│   │   ├── services/          # api.ts (axios), auth.service.ts, wallet.service.ts…
│   │   ├── store/             # authStore.ts, uiStore.ts
│   │   ├── types/
│   │   ├── utils/             # money, dates (Africa/Nairobi), idempotency
│   │   ├── App.tsx  main.tsx  index.css
│   ├── index.html  vite.config.ts  tailwind config  tsconfig.json  Dockerfile  package.json
├── server/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/        # incl. raw SQL: CHECKs + immutability triggers
│   │   └── seed.ts
│   ├── src/
│   │   ├── config/            # env.ts (zod), constants.ts, brand.ts
│   │   ├── controllers/
│   │   ├── middleware/        # auth, requireRole, validate, idempotency, rateLimit, errorHandler, requestId
│   │   ├── providers/
│   │   │   ├── payment/       # PaymentProvider.ts, DemoProvider.ts, registry.ts
│   │   │   ├── otp/           # OtpProvider.ts, ConsoleOtpProvider.ts
│   │   │   └── storage/       # StorageProvider.ts, LocalStorageProvider.ts
│   │   ├── repositories/
│   │   ├── routes/
│   │   ├── services/          # auth, ledger, transfer, paymentRequest, billSplit, qr, business, notification, audit, admin, feed
│   │   ├── jobs/              # requestExpirySweep.ts
│   │   ├── types/
│   │   ├── utils/             # money.ts, reference.ts, phone.ts, crypto.ts, AppError.ts, logger.ts
│   │   ├── validators/
│   │   ├── app.ts             # express app (no listen — testable)
│   │   └── server.ts          # bootstrap + listen
│   ├── tests/
│   │   ├── helpers/           # test db reset, factories, auth helper
│   │   ├── integration/       # auth, wallet, transfers, requests, splits, business, admin, authz
│   │   └── unit/              # money, phone, reference, split allocation
│   ├── vitest.config.ts  tsconfig.json  Dockerfile  package.json
├── shared/
│   ├── src/                   # schemas/, enums.ts, errorCodes.ts, money.ts, brand.ts
│   └── package.json  tsconfig.json
├── docs/
│   ├── 00-architecture-plan.md   (this file)
│   ├── architecture.md  database.md  api.md  security.md
├── .env.example
├── docker-compose.yml
├── package.json               # npm workspaces + root scripts
├── .editorconfig  .gitignore  .prettierrc  eslint.config.js
└── README.md
```

---

## 6. Implementation Roadmap

Each phase ends with: summary, file list, key file contents, run/test instructions,
known assumptions — and a stop for your review.

| Phase | Scope | Exit criteria |
|---|---|---|
| **1. Architecture + setup** | Workspaces, TS configs, ESLint/Prettier, Express skeleton (helmet, cors, request ID, error handler, `/api/health`), env validation, Vite + Tailwind + Router shell, theme tokens, DemoBanner, brand config, Docker Compose, `.env.example` | `docker compose up` → client shows shell with demo banner; health returns 200; lint + typecheck pass |
| **2. Database + Prisma** | Full schema, initial migration, raw SQL CHECKs + immutability triggers, Prisma client singleton, base repositories, seed scaffold | Migration applies cleanly; triggers reject ledger UPDATE (tested) |
| **3. Authentication** | Register (user/business), login by email/phone/username, argon2id, PIN hashing, JWT access + rotating refresh sessions, lockout, `requireAuth`/`requireRole`, OTP interfaces; client auth pages + guards + token refresh | Auth integration tests green |
| **4. Wallet + ledger** | `LedgerService.post`, treasury, wallet endpoints, reconciliation, demo funding via DemoProvider, money utils; client Wallet page + BalanceCard | Ledger invariants tested (balanced entries, sum = 0) |
| **5. Send / receive** | Transfers with idempotency middleware, PIN check, limits, ordered locking; client Send flow with confirm sheet + PinPad + success | Transfer, insufficient balance, duplicate key, concurrency tests green |
| **6. Payment requests + split bills** | Requests (create/pay/decline/cancel/expire), split bills with allocation; client pages | Request + split tests green |
| **7. QR payments** | QR codes (static/dynamic), resolve endpoint, client QrCard + camera scanner + pay-by-QR flow | Scan → confirm → pay works; QR never auto-pays |
| **8. Business accounts** | Business registration/profile, business pay, dashboard stats, customers, analytics endpoints; business layout + pages + Recharts | Business payment tests green |
| **9. Transactions + receipts** | History with filters + cursor pagination, detail, receipt endpoint + printable receipt page; contacts + privacy-first activity feed | Filters and receipt authz tested |
| **10. Notifications** | Notification service hooks across flows, centre UI, unread badge, new-device alert | Notification creation tested per flow |
| **11. Admin dashboard** | Stats, user/business management, suspend/reactivate, transactions, audit log viewer, balance adjustments, reconciliation view | Admin access + suspension tests green |
| **12. Security hardening** | Rate-limit tuning per route, CSRF checks on cookie routes, log redaction, upload hardening, security headers review, dependency audit | Security checklist in `docs/security.md` satisfied |
| **13. Testing** | Fill coverage gaps; financial paths ≥ 90 % branch coverage; race-condition tests; CI-ready scripts | All tests green |
| **14. UI polish + responsive** | Mobile-first pass at 360/768/1024/1440, dark mode audit, a11y audit, motion, skeletons/empty states everywhere | Manual checklist + Playwright smoke screenshots |
| **15. Documentation** | README + `docs/architecture.md`, `database.md`, `api.md`, `security.md`; seed credentials table; production & regulatory notes | Docs complete |

Tests are written **alongside** each phase from Phase 3 onward; Phase 13 is consolidation, not the first time tests appear.

### Seed data (Phase 4 onward)

| Account | Role | Simulated balance |
|---|---|---|
| @caleb254 (Caleb Chimera) | USER | KSh 25,000.00 |
| @john254 | USER | KSh 10,000.00 |
| @brian254 | USER | KSh 7,500.00 |
| @mike254 | USER | KSh 5,000.00 |
| @david254 | USER | KSh 5,000.00 (needed for the 5-person split example) |
| @visiblegeneral — VISIBLE GENERAL SUPPLIES LTD | BUSINESS | KSh 50,000.00 |
| @admin | ADMIN | — (no wallet) |

All flagged `isDemo = true`, funded via `FUNDING` transactions from the treasury, plus a few
sample transfers/requests/splits so the dashboards aren't empty. Demo passwords documented in
the README only for local use.

---

## 7. Dependencies

Versions pinned to current stable at install time in Phase 1.

### Root (dev)
`typescript`, `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `prettier`, `concurrently`

### shared
`zod`, `decimal.js`

### server
| Runtime | Purpose |
|---|---|
| `express` (v5) | HTTP framework (native async error propagation) |
| `@prisma/client` | ORM client |
| `zod` | Validation + env parsing |
| `argon2` | Password & PIN hashing (argon2id) |
| `jsonwebtoken` | JWT |
| `helmet` | Security headers |
| `cors` | CORS |
| `cookie-parser` | Refresh-token cookie |
| `express-rate-limit` | Rate limiting |
| `decimal.js` | Exact money arithmetic (also what Prisma.Decimal uses) |
| `libphonenumber-js` | Kenyan phone validation/normalisation |
| `pino`, `pino-http` | Structured logging with redaction |
| `multer` | Avatar/logo uploads |
| `file-type` | Upload MIME sniffing |

| Dev | Purpose |
|---|---|
| `prisma` | CLI/migrations |
| `tsx` | Dev runner + seed |
| `vitest`, `supertest`, `@types/supertest` | Tests against a real Postgres test DB |
| `@types/express`, `@types/jsonwebtoken`, `@types/cookie-parser`, `@types/cors`, `@types/multer`, `@types/node` | Types |
| `pino-pretty` | Dev log formatting |

### client
| Runtime | Purpose |
|---|---|
| `react`, `react-dom` | UI |
| `react-router` (v7) | Routing |
| `axios` | HTTP |
| `@tanstack/react-query` | Server state (recommended — see §2 #29) |
| `zustand` | Auth/UI state |
| `lucide-react` | Icons |
| `recharts` | Charts |
| `qrcode.react` | QR rendering (SVG) |
| `html5-qrcode` | Camera QR scanning |
| `react-hook-form`, `@hookform/resolvers` | Forms with shared Zod schemas |
| `clsx`, `tailwind-merge` | Class composition |

| Dev | Purpose |
|---|---|
| `vite`, `@vitejs/plugin-react` | Build/dev server |
| `tailwindcss` (v4), `@tailwindcss/vite` | Styling |
| `vitest`, `@testing-library/react`, `jsdom` | Component tests (light) |

### Infrastructure
PostgreSQL 16 (Docker image `postgres:16-alpine`), Node.js 22 LTS.

---

## 8. Regulatory Boundary (applies to every phase)

- The app displays **"Demo environment. No real money is transferred."** on auth pages, footer and receipts, and the persistent **DEMO MODE — NO REAL MONEY** banner.
- No connections to M-Pesa, Airtel Money, banks, card networks or gateways.
- No claim of being a licensed Kenyan payment service provider.
- Before handling real funds, a production version must be reviewed against applicable Kenyan
  requirements — including the National Payment System Act and CBK regulations, AML/CFT and
  KYC obligations, the Data Protection Act 2019 (ODPC), and the Computer Misuse and Cybercrimes
  Act — with qualified legal counsel.

---

## 9. Decisions Needing Your Input (defaults will be used if you just approve)

1. **TanStack Query** for server state — *default: yes.*
2. **`shared/` workspace** for Zod schemas/enums/money utils — *default: yes.*
3. **Feed hides amounts from non-participants** — *default: yes (privacy-first).*
4. **Admins have no wallet and cannot transact** — *default: yes.*
5. **Phase reports**: key files inline, everything else on the branch — *default: yes.*
6. **Per-transaction / daily limits** KSh 150,000 / 300,000 — *default: yes, configurable.*
