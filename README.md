# KESPAY

> **DEMO MODE — NO REAL MONEY.** Demo environment. No real money is transferred.
> This is a software demonstration using simulated Kenyan Shillings. It is not a licensed
> payment service provider and is not connected to M-Pesa, Airtel Money, banks or card networks.

A Kenyan digital wallet and social payments platform: send, request and split simulated KES,
pay businesses by QR, and view receipts and activity. `KESPAY` is a temporary name — branding
lives in [`shared/src/brand.ts`](shared/src/brand.ts).

**Build status:** Phase 1 of 15 (architecture + project setup). See the
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
server/   Express REST API (+ prisma/ from Phase 2)
shared/   Brand, error codes and API contracts used by both sides
docs/     Architecture and design documentation
```

## Quick start (local development)

Requirements: Node.js ≥ 22.12, npm ≥ 10, Docker (for PostgreSQL from Phase 2 onward).

```bash
cp .env.example .env
# Generate a real JWT secret and paste it into .env:
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

npm install
npm run dev          # shared (watch) + API on :4000 + web on :5173
```

Open http://localhost:5173 — the System status card confirms the web app can reach the API.

## Run everything in Docker

```bash
cp .env.example .env   # set JWT_SECRET — production mode refuses the placeholder
docker compose up --build
```

Web: http://localhost:8080 (nginx serves the SPA and proxies `/api` to the server).

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

## Environment variables

See [`.env.example`](.env.example). The server validates its environment at boot and exits if
anything is missing or unsafe — including `DEMO_MODE` not set to `true`.

## Regulatory boundary

Before any version handles real customer funds it must be reviewed against applicable Kenyan
requirements — including the National Payment System Act and CBK regulations, AML/CFT and KYC
obligations, the Data Protection Act 2019 and the Computer Misuse and Cybercrimes Act.
