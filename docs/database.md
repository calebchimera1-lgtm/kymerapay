# Database

PostgreSQL 16, accessed through Prisma 7 with the `@prisma/adapter-pg` driver adapter.
Schema: [`server/prisma/schema.prisma`](../server/prisma/schema.prisma).
Migrations: [`server/prisma/migrations`](../server/prisma/migrations).

## Conventions

| Rule     | Detail                                                             |
| -------- | ------------------------------------------------------------------ |
| IDs      | UUID v4 (`@db.Uuid`)                                               |
| Naming   | `snake_case` tables and columns via `@@map` / `@map`               |
| Money    | `NUMERIC(18,2)` (Prisma `Decimal`). Never JavaScript `number`      |
| Time     | `timestamptz(3)` in UTC; shown in `Africa/Nairobi`                 |
| Currency | `KES` only (CHECK-enforced)                                        |
| Deletes  | Financial rows are never deleted; corrections are new transactions |

## Entities

| Table               | Purpose                                                                  |
| ------------------- | ------------------------------------------------------------------------ |
| `users`             | People, businesses, admins and the SYSTEM account                        |
| `sessions`          | Hashed, rotating refresh tokens with device fingerprints                 |
| `otp_challenges`    | Prepared for future OTP flows (not enforced in V1)                       |
| `business_profiles` | 1:1 business details for `BUSINESS` users                                |
| `wallets`           | One per account; `balance` is a cached projection of the ledger          |
| `transactions`      | One row per money movement; financial columns immutable                  |
| `ledger_entries`    | Double-entry lines (one DEBIT + one CREDIT per transaction); append-only |
| `idempotency_keys`  | Stored responses for replaying duplicate money-moving requests           |
| `payment_requests`  | Requests to be paid; may belong to a bill split                          |
| `bill_splits`       | A shared bill …                                                          |
| `bill_participants` | … and each person's share                                                |
| `qr_codes`          | Opaque static (profile) and dynamic (fixed-amount) payment codes         |
| `contacts`          | Saved contacts; mutual contacts are "friends" for the activity feed      |
| `notifications`     | In-app notification centre                                               |
| `audit_logs`        | Security and financial audit trail; append-only                          |

```
users 1─1 wallets 1─* ledger_entries *─1 transactions
users 1─0..1 business_profiles          transactions *─1 wallets (from / to)
users 1─* sessions, qr_codes, notifications, contacts, audit_logs, idempotency_keys
users 1─* payment_requests (requester / payer)   payment_requests 0..1─1 transactions
users 1─* bill_splits 1─* bill_participants 0..1─1 payment_requests
```

## The treasury

Simulated money has to come from somewhere for the ledger to balance. A non-login `SYSTEM`
user owns the single `TREASURY` wallet, the counter-party for demo funding and admin
adjustments. It is the only wallet allowed to go negative, so **the sum of all wallet balances
is always exactly zero**. `ensureTreasury()` creates it idempotently (seed and tests).

## Integrity rules enforced by the database

The application enforces all of these; the database enforces them again so that a bug or a
manual query cannot corrupt the ledger. See
[`…_ledger_integrity/migration.sql`](../server/prisma/migrations/20261009135613_ledger_integrity/migration.sql).

**CHECK constraints**

- Usernames `^[a-z0-9_]{3,20}$`; e-mails lowercase; phones Kenyan E.164 `+2547…`/`+2541…`.
- Credentials by role: SYSTEM has none; ADMIN has a password but no PIN; USER/BUSINESS need a
  password, a PIN and a phone.
- Non-treasury balances ≥ 0; all amounts > 0; no self-transfers or self-requests.
- Transaction references match `TXN-` + 10 Crockford base32 characters.
- Bill participants: `0 ≤ amount_paid ≤ amount_owed`.
- Static QR codes carry no amount; one active static QR per user (partial unique index).
- Exactly one treasury wallet (partial unique index).

**Triggers**

| Trigger                                             | Rule                                                                                                                                                 |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ledger_entries_append_only`                        | No UPDATE or DELETE on ledger entries                                                                                                                |
| `audit_logs_append_only`                            | No UPDATE or DELETE on audit logs                                                                                                                    |
| `transactions_guard`                                | Financial columns immutable; status only PENDING→COMPLETED/FAILED or COMPLETED→REVERSED; no DELETE                                                   |
| `wallets_guard`                                     | Owner, type and currency immutable; no DELETE                                                                                                        |
| `wallets_balance_matches_ledger`                    | _Deferred to COMMIT_: balance must equal the sum of its ledger entries                                                                               |
| `transactions_balanced` / `ledger_entries_balanced` | _Deferred to COMMIT_: a completed transaction has exactly one DEBIT of the source wallet and one CREDIT of the destination, each equal to the amount |

Deferred triggers let a service write the transaction, entries and balances in any order inside
one DB transaction, but make an inconsistent state impossible to commit.

> `TRUNCATE` bypasses row triggers. Only the disposable test database uses it; production
> database roles should not be granted `TRUNCATE`, `ALTER` or trigger management.

## Commands

```bash
npm run db:migrate          # create/apply migrations in development (prisma migrate dev)
npm run db:migrate:deploy   # apply pending migrations (CI / production)
npm run db:seed             # idempotent seed
npm run db:reset            # drop, re-migrate and re-seed the dev database
npm run db:studio           # browse data
```

The test-suite migrates its own database (`TEST_DATABASE_URL`) and truncates it between tests.
It refuses any database whose name does not contain `test`.
