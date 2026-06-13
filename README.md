# StayBase — Apartment Rental Portal

A modular monolith built with Next.js 14+, Prisma, Auth.js, and Tailwind CSS.

## Quick Start (Local Development)

### Prerequisites
- Node.js 18+
- Docker (for local Postgres)

### Setup

```bash
# 1. Clone and install
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — DATABASE_URL is pre-filled for the Docker Postgres below

# 3. Start local Postgres
docker compose -f docker-compose.dev.yml up -d

# 4. Apply database migrations
npm run db:migrate

# 5. Seed default amenities
npm run db:seed

# 6. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server (hot reload) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint check |
| `npm run test` | Run Vitest unit tests |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:seed` | Seed default data |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run db:studio` | Open Prisma Studio |

## Environment Variables

See `.env.example` for all required variables.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | Random secret for JWT signing |
| `NEXTAUTH_URL` | Yes | Full URL of the app (e.g. http://localhost:3000) |
| `RESEND_API_KEY` | No | Resend email API key (falls back to console log) |
| `EMAIL_FROM` | No | Sender address for emails |
| `APP_URL` | Yes | Base URL (used in email links) |
| `CRON_SECRET` | Yes | Secret to protect `/api/jobs/*` endpoints |

## Architecture

See `rental-portal-architecture.md` for the complete specification.

**Three portals:**
- `/` — Public listing catalog (unauthenticated)
- `/host/...` — Host dashboard (listing management, logistics, staff)
- `/staff/...` — Staff portal (prep slots, inventory)

**Tech stack:** Next.js 14 App Router · TypeScript · Tailwind CSS · Radix UI · Prisma · PostgreSQL · Auth.js (next-auth v4) · Zod · Resend · Vitest

## Docker (Option B — Self-hosted)

A full `docker-compose.yml` for production will be added by Agent J. For development only, use `docker-compose.dev.yml`.

## Deployment (Option A — Vercel + Supabase)

1. Create a Supabase project in the EU region and copy the connection string to `DATABASE_URL`
2. Deploy to Vercel and set all env vars in the Vercel dashboard
3. Configure Vercel Cron for `/api/jobs/daily` (07:00 Europe/Berlin) and `/api/jobs/hourly`

Full deployment docs will be added by Agent J.
