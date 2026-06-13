# StayBase — Project Guide for AI Sessions

**Authoritative spec:** `rental-portal-architecture.md` — consult it before any structural change.

---

## Hard Rules (§10.0 — must not be violated)

1. `prisma/schema.prisma` is the source of truth. You may ADD models/fields via a new migration; never modify another module's models. Flag proposed changes as `// PROPOSED-CHANGE:` comments only.
2. Only create/edit files inside your **OWNED PATHS**. Shared files you may import but not edit: `src/lib/db.ts`, `src/lib/auth/*`, `src/components/ui/*`, `src/lib/notify.ts`.
3. All API routes: validate input with Zod, return `{ data }` on success and `{ error: { code, message, fields? } }` on failure with correct HTTP status. Enforce authorization with guards: `requireAuth`, `requireListingOwner`, `requireListingStaff`, `requireParticipant`.
4. Server-side logic lives in `src/modules/<module>/service.ts`; API route handlers stay thin.
5. UI: use components from `src/components/ui` only; responsive (mobile-first); no inline hex colors — use Tailwind theme tokens.
6. Every endpoint and service function gets at least one Vitest test (happy path + one auth failure).
7. `npm run build`, `npm run lint`, `npm run test`, `npx prisma validate` must pass before finishing.
8. Document each module in `src/modules/<module>/README.md`.
9. Dates: store UTC; check-in/check-out are DateTime; calendar ranges use checkout-style exclusive end dates. Default currency EUR.
10. Never log passwords, tokens, or message bodies.

---

## Repository Ownership Map (§8)

| Path | Owner |
|---|---|
| `prisma/schema.prisma` | Agent A (others append migrations) |
| `src/lib/db.ts`, `src/lib/auth/**`, `src/lib/email/**`, `src/lib/validation/common.ts` | Agent A |
| `src/app/api/auth/**`, `src/app/api/me`, `src/app/api/account` | Agent A |
| `src/components/ui/**`, `src/components/layout/**`, all portal `layout.tsx`, Tailwind config | Agent B |
| `src/modules/listings/**`, `src/app/api/listings/**` (except sub-routes), `src/app/(host)/host/listings/**` | Agent C |
| `src/app/(public)/**`, `src/modules/catalog/**` | Agent D |
| `src/modules/availability/**`, `src/app/api/listings/[id]/calendar/**`, `src/app/(host)/host/calendar/**` | Agent E |
| `src/modules/inquiries/**`, inquiry API routes, email templates `inquiry-*.tsx` | Agent F |
| `src/modules/stays/**`, `src/modules/notifications/**`, `src/lib/notify.ts`, stays/jobs API routes | Agent G |
| `src/modules/logistics/**`, logistics API routes, `<LogisticsPanel>` | Agent H |
| `src/modules/staff/**`, staff API routes, `src/app/(staff)/**`, `src/app/(host)/host/staff/**` | Agent I |
| `e2e/**`, `prisma/seed.ts` (extend), `docker/**`, `vercel.json`, CI workflows | Agent J |

---

## Build Order (§9)

```
Phase 0  Agent A (foundation: scaffold, schema, auth)  ──┐
Phase 0  Agent B (UI kit & app shell)                  ──┤  must finish first
Phase 1  Agents C, E, G-schema  — parallel
Phase 2  Agents D, F, G, H      — parallel
Phase 3  Agent I (depends on G + H)
Phase 4  Agent J (integration, E2E, deployment)
```

---

## Coordination Checklist (§11)

| Interface | Producer | Consumer |
|---|---|---|
| `schema.prisma` + guards + email adapter | A | all |
| UI components & layouts | B | C–I |
| `GET /listings/:id/calendar` response shape | E | D |
| `availability.setBooked / releaseBooked / isRangeAvailable` | E | G |
| `notify()` service | G | F, H, I, C |
| `<InquiryEntry>` component | F | D |
| `<LogisticsPanel>` + `logistics.lastUpdatedAt` | H | I |
| `logistics.seedDefaults(listingId)` | H | C |
| ACCEPTED prep slots → arrival/departure recipients | I (data) | G (cron) |
| Everything | A–I | J |

---

## Tech Stack

Next.js 14+ App Router · TypeScript · Tailwind CSS · shadcn/ui (Radix UI) · Prisma + PostgreSQL · Auth.js (next-auth v4) · Zod · Resend (email) · Vitest · Playwright (E2E)

## Local Dev

```bash
cp .env.example .env          # fill in DATABASE_URL etc.
docker compose -f docker-compose.dev.yml up -d   # start Postgres
npm install
npm run db:migrate            # apply migrations
npm run db:seed               # seed amenities
npm run dev                   # http://localhost:3000
```
