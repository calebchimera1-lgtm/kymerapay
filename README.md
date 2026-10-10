# KESPAY

> **DEMO MODE — NO REAL MONEY.** Demo environment. No real money is transferred.
> This is a software demonstration using simulated Kenyan Shillings. It is not a licensed
> payment service provider and is not connected to M-Pesa, Airtel Money, banks or card networks.

A Kenyan digital wallet and social payments platform: send, request and split simulated KES,
pay businesses by QR, and view receipts and activity. `KESPAY` is a temporary name — branding
lives in [`shared/src/brand.ts`](shared/src/brand.ts).

**Build status:** Phase 8 of 15 (business accounts). See the
[architecture plan](docs/00-architecture-plan.md) for the roadmap.

## Stack

| Layer    | Tech                                                                              |
| -------- | --------------------------------------------------------------------------------- |
| Client   | React 19, TypeScript, Vite, Tailwind CSS 4, React Router, TanStack Query, Zustand |
| Server   | Node.js 22, Express 5, TypeScript, Zod, Pino, Helmet                              |
| Database | PostgreSQL 16 + Prisma (Phase 2)                                                  |
| Tooling  | npm workspaces, ESLint, Prettier, Vitest + Supertest, Docker Compose              |

## Repository layout

```
client/   React web app
server/   Express REST API; prisma/ holds the schema, migrations and seed
shared/   Brand, error codes and API contracts used by both sides
docs/     Architecture and design documentation
```

## Quick start (local development)

Requirements: Node.js ≥ 22.12, npm ≥ 10, Docker (or a local PostgreSQL 16).

```bash
cp .env.example .env
# Generate a real JWT secret and paste it into .env:
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

npm install
docker compose up -d postgres                 # dev database on :5432
docker compose --profile test up -d postgres-test   # test database on :5433
npm run db:migrate:deploy                     # apply migrations
npm run db:seed                               # demo data (idempotent)
npm run dev          # shared (watch) + API on :4000 + web on :5173
```

Open http://localhost:5173 — the System status card confirms the web app can reach the API.

## Run everything in Docker

```bash
cp .env.example .env   # set JWT_SECRET — production mode refuses the placeholder
docker compose up --build
```

Web: http://localhost:8080 (nginx serves the SPA and proxies `/api` to the server). The
`migrate` service applies migrations before the API starts. Load demo data with
`docker compose run --rm migrate npm run db:seed`.

## Scripts (repo root)

| Command             | What it does                                |
| ------------------- | ------------------------------------------- |
| `npm run dev`       | Run shared, server and client in watch mode |
| `npm run build`     | Production build of all packages            |
| `npm run typecheck` | TypeScript checks for server and client     |
| `npm run lint`      | ESLint across the monorepo                  |
| `npm run format`    | Prettier write                              |
| `npm test`          | Backend test-suite                          |

## API (so far)

| Method | Path                 | Description                     |
| ------ | -------------------- | ------------------------------- |
| GET    | `/api/health`        | Liveness / readiness            |
| GET    | `/api/config/public` | Non-secret client configuration |

Every response uses the envelope `{ "success": true, "data": … }` or
`{ "success": false, "error": { "code", "message", "requestId" } }`.

## Demo accounts

After `npm run db:seed` (local development only — never reuse these credentials):

| Account                                             | Sign in with              | Password     | PIN    |
| --------------------------------------------------- | ------------------------- | ------------ | ------ |
| @caleb254, @john254, @brian254, @mike254, @david254 | username, e-mail or phone | `Demo@2026`  | `1357` |
| @visiblegeneral — VISIBLE GENERAL SUPPLIES LTD      | `visiblegeneral`          | `Demo@2026`  | `1357` |
| @admin (administrator, no wallet)                   | `admin`                   | `Admin@2026` | —      |

Opening balances (simulated): Caleb KSh 25,000 · John 10,000 · Brian 7,500 · Mike 5,000 ·
David 5,000 · Visible General Supplies 50,000. Each is a FUNDING transaction from the treasury.

## The ledger

Every money movement goes through one function, `postTransfer`
([server/src/services/ledger.service.ts](server/src/services/ledger.service.ts)): it locks both
wallets (`SELECT … FOR UPDATE`, always in id order so opposite transfers cannot deadlock),
checks status and balance, then writes one immutable transaction, a DEBIT and a CREDIT ledger
line and both new balances in a single database transaction. PostgreSQL re-verifies the result at
commit. Money is `Decimal` on the server and 2-dp strings on the wire — never floating point.

### Requests and bill splits

A payment request is `PENDING` until the payer pays or declines, the requester cancels, or it
expires (7 days by default; overdue requests read as `EXPIRED` immediately and a background job
records it). Paying locks the request row for the whole money transaction, so a simultaneous pay
and decline can never both succeed.

A bill split creates one share per person and a linked payment request for everyone except the
creator, whose share counts as settled. Equal splits allocate leftover cents to the first shares
(`1,000 ÷ 3 → 333.34 · 333.33 · 333.33`) — the same shared function runs in the browser preview and
on the server. A split becomes `SETTLED` when every share is paid.

### QR payments

A QR encodes only an opaque, random code — `kespay://pay/<code>` — never a username or phone
number. Scanning resolves the code to the payee's public profile and opens the normal send flow:
the payer reviews the payee and amount and confirms with their PIN. **A scan never pays by
itself.** Businesses can also create single-use codes for an exact amount with an expiry; the
server enforces the amount and consumes the code inside the payment's database transaction, so it
can be paid only once. Phone camera apps can open `https://<app>/pay/<code>` links too.

### Business accounts

Businesses have their own wallet and a dashboard: today's sales, transactions and customers,
pending requests, and a 7-day sales chart. They also get analytics for 7, 30 or 90 days, compared
with the previous period, plus their top customers, a paginated customer list, payments received
and sent requests, and an editable business profile with a logo. Customer lists show names and
usernames only, never phone numbers or e-mails. A sale is any completed incoming transfer
(direct, QR, request or split payment).

| Method | Path                           | Who      | Description                          |
| ------ | ------------------------------ | -------- | ------------------------------------ |
| GET    | `/api/businesses/:username`    | any      | Public business card                 |
| POST   | `/api/businesses/:id/pay`      | USER     | Pay a business (PIN, idempotent)     |
| GET    | `/api/businesses/me/dashboard` | BUSINESS | Today's figures, balance, pending    |
| GET    | `/api/businesses/me/analytics` | BUSINESS | `?days=7\|30\|90`                    |
| GET    | `/api/businesses/me/customers` | BUSINESS | `?page&limit`                        |
| PATCH  | `/api/businesses/me`           | BUSINESS | Update details (`""` clears a field) |
| POST   | `/api/businesses/me/logo`      | BUSINESS | Upload logo (`multipart`, `file`)    |
| PATCH  | `/api/users/me`                | any      | Update name / default visibility     |
| POST   | `/api/users/me/avatar`         | any      | Upload avatar                        |
| DELETE | `/api/users/me/avatar`         | any      | Remove avatar                        |

### Image uploads

Uploads accept PNG, JPEG or WebP up to 2 MB. The type is detected from the file's bytes, not its
name or `Content-Type`. Every image is re-encoded to a 512 px WebP, which strips EXIF data such
as GPS location and anything hidden in the original file. Files get random names under
`UPLOAD_DIR` and are served from `/uploads` with `nosniff` and a sandboxing CSP. Replacing an
image deletes the old file. Storage sits behind a `StorageProvider` interface, so the local disk
can later be swapped for object storage.

### Idempotency

Every money-moving request must carry an `Idempotency-Key` header (16–100 URL-safe characters,
generated by the client per intended payment):

| Situation                                 | Response                                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------------- |
| First request                             | Executed normally                                                            |
| Same key, same request, already done      | Original response replayed (`Idempotent-Replayed: true`) — no second payment |
| Same key, different request               | `422 IDEMPOTENCY_KEY_REUSED`                                                 |
| Same key while the first is still running | `409 REQUEST_IN_PROGRESS`                                                    |
| First request failed (e.g. wrong PIN)     | Key released — retry with the same key                                       |

The key is completed inside the same database transaction as the payment, and a reservation
abandoned by a crashed request is fenced off before another can take it over. PINs never enter
the stored request fingerprint.

`npm run ledger:check` independently re-derives every balance from the ledger and confirms the
whole system sums to zero (exit code 1 if not).

Payment rails sit behind a `PaymentProvider` interface
([server/src/providers/payment](server/src/providers/payment)). V1 registers only the
`DemoProvider`, which settles simulated money instantly and contacts nothing.

## Authentication in brief

- Passwords and PINs are hashed with argon2id; neither is ever stored or logged in plaintext.
- A 15-minute access token (JWT) lives only in browser memory. A refresh token lives in an
  `httpOnly; SameSite=Strict` cookie scoped to `/api/auth`, is stored hashed, and rotates on
  every use. Replaying an old refresh token signs out every device in that session family.
- Five wrong passwords lock sign-in for 15 minutes; five wrong PINs pause payments for 15
  minutes. Role, status and session are re-checked against the database on every request.

## Database

See [docs/database.md](docs/database.md) for the schema, the treasury model and the integrity
rules the database enforces (append-only ledger, balance = sum of ledger, and more).

## Environment variables

See [`.env.example`](.env.example). The server validates its environment at boot and exits if
anything is missing or unsafe — including `DEMO_MODE` not set to `true`.

## Regulatory boundary

Before any version handles real customer funds it must be reviewed against applicable Kenyan
requirements — including the National Payment System Act and CBK regulations, AML/CFT and KYC
obligations, the Data Protection Act 2019 and the Computer Misuse and Cybercrimes Act.
