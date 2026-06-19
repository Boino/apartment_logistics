# StayBase — Rental Portal: Software Architecture & Subagent Development Plan

Working name: **StayBase** (rename freely). Beta scope: small number of listings, no search, no payments.

---

## 1. Product summary

A web application (responsive, mobile-friendly, installable as a PWA later) with three role-based portals on a single codebase:

| Role | Portal | Core capabilities |
|---|---|---|
| **Guest** | Public site + guest area | Browse listing list, view detail (photos, amenities, location, pricing, availability), register/login, send inquiry (form → email to host + in-app message thread), contact via WhatsApp deep link |
| **Host** | Host dashboard | CRUD listings, upload photos, amenities, location (exact pin or general area), availability & pricing calendar, manage inquiries/messages, record confirmed stays, invite staff, assign preparation slots, view logistics status, receive arrival/departure notifications, see "Done" reports to trigger (manual, off-platform) payment |
| **Staff** | Staff portal | Accept/decline prep slots, see check-out/check-in times for assigned slots, view current linen & consumable status, update inventory, report damages, mark slot "Done" |

Out of scope for beta: payments, regional search, reviews, booking/payment-confirmed reservations (hosts record stays manually after agreeing with the guest), native mobile apps, WhatsApp Business API.

---

## 2. Architecture style: modular monolith

One deployable Next.js application containing the three frontends (route groups) and all backend modules (API routes + service layer). Modules communicate only through their service interfaces and a shared database schema, so each module can be developed by an independent subagent and merged with minimal conflicts. Later, hot modules (e.g. messaging) can be extracted to services.

**Why not microservices for the beta:** one deploy, one database, one auth session, drastically lower DevOps cost; team-of-subagents isolation is achieved with folder ownership + interface contracts instead.

---

## 3. Tech stack

| Concern | Choice | Rationale |
|---|---|---|
| Framework | **Next.js 14+ (App Router, TypeScript)** | Frontend + API in one repo; SSR for the public catalog (SEO); Vercel-friendly |
| UI | React + Tailwind CSS + shadcn/ui components | Fast, consistent, easy for parallel agents to share a design system |
| ORM / DB | **Prisma + PostgreSQL** | Single source-of-truth schema (`schema.prisma`) that every subagent codes against |
| DB hosting | Supabase or Neon (managed Postgres, **encryption at rest**, EU region — see GDPR note) | Zero-ops, free tier fits a beta |
| Auth | **Auth.js (NextAuth) credentials provider**, bcrypt password hashing, JWT session cookies (httpOnly, Secure, SameSite=Lax) | "Encrypted user storage" = hashed passwords + TLS in transit + DB encryption at rest |
| File storage | Supabase Storage or Cloudflare R2 (S3 API), images served via CDN, resized on upload (sharp) | Listing photos |
| Email | Resend (or Postmark/SendGrid) with React Email templates | Inquiry notifications, staff invites, arrival/departure alerts |
| WhatsApp | `https://wa.me/<host_phone>?text=<prefilled>` deep links | No API approval needed in beta |
| In-app notifications | `notifications` table + polling (or SSE) + bell icon | Push notifications later |
| Scheduler | Vercel Cron (or node-cron on VPS) hitting `/api/jobs/daily` and `/api/jobs/hourly` | Drives arrival/departure notifications |
| Maps | Leaflet + OpenStreetMap tiles (free) | Pin or area-circle display; host picks point on map |
| Validation | Zod schemas shared between client and server | Contract enforcement across subagents |
| Testing | Vitest (unit), Playwright (E2E) | Integration agent runs the E2E suite |
| Hosting | **Option A:** Vercel (app) + Supabase (DB/storage/auth) — fastest. **Option B:** Docker Compose (app + Postgres + Caddy) on a Hetzner VPS — cheap, EU-resident, full control | Either works; decide before Agent J runs |

**GDPR note (EU users):** host data in an EU region, hash passwords with bcrypt (cost ≥ 12), collect explicit consent checkbox at registration, provide account-deletion endpoint, keep a minimal privacy policy page. No analytics cookies in beta → no cookie banner needed.

---

## 4. Roles & permissions

- `users.role` is not global; capabilities derive from relationships:
  - Anyone registered is a **guest** (can inquire).
  - A user becomes a **host** by creating their first listing (or toggling "I want to list" at signup).
  - A user becomes **staff for a listing** via an accepted `staff_assignments` invite.
- Authorization middleware: `requireAuth()`, `requireListingOwner(listingId)`, `requireListingStaff(listingId)`, `requireParticipant(threadId)`.
- Public (unauthenticated) access: listing list + listing detail + availability/pricing view. Inquiry submission requires login.

---

## 5. Data model (Prisma / PostgreSQL)

> This schema is the **single shared contract**. Agent A creates it; all other agents may ADD migrations for their own tables but must not alter another module's tables without flagging it.

```prisma
model User {
  id            String   @id @default(cuid())
  name          String
  email         String   @unique
  passwordHash  String
  phone         String?            // E.164, used for WhatsApp deep links (hosts)
  isHost        Boolean  @default(false)
  createdAt     DateTime @default(now())
  // relations: listings, inquiries, messages, staffAssignments, prepSlots, notifications
}

model Listing {
  id                String   @id @default(cuid())
  hostId            String
  title             String
  description       String   @db.Text
  addressText       String             // free-text city/area always shown
  lat               Float?
  lng               Float?
  locationPrecision LocationPrecision @default(AREA) // EXACT | AREA (area = circle ~500 m)
  maxGuests         Int      @default(2)
  bedrooms          Int      @default(1)
  basePricePerNight Decimal  @db.Decimal(10,2)
  currency          String   @default("EUR")
  status            ListingStatus @default(DRAFT)    // DRAFT | PUBLISHED | ARCHIVED
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

model ListingPhoto { id String @id @default(cuid()); listingId String; url String; sortOrder Int @default(0); isCover Boolean @default(false) }

model Amenity        { id String @id @default(cuid()); name String @unique; icon String? }
model ListingAmenity { listingId String; amenityId String; @@id([listingId, amenityId]) }

// Calendar: non-overlapping date ranges per listing. Default state when no block exists = AVAILABLE at basePricePerNight.
model AvailabilityBlock {
  id        String @id @default(cuid())
  listingId String
  startDate DateTime @db.Date          // inclusive
  endDate   DateTime @db.Date          // exclusive (check-out style)
  status    BlockStatus                // AVAILABLE | BLOCKED | BOOKED
  nightlyPrice Decimal? @db.Decimal(10,2) // overrides basePrice when status=AVAILABLE
}

model Inquiry {
  id           String  @id @default(cuid())
  listingId    String
  guestId      String
  checkinDate  DateTime @db.Date
  checkoutDate DateTime @db.Date
  numGuests    Int
  comments     String? @db.Text
  status       InquiryStatus @default(OPEN)  // OPEN | ANSWERED | CONFIRMED | DECLINED | CLOSED
  createdAt    DateTime @default(now())
  thread       Thread?
}

model Thread  { id String @id @default(cuid()); inquiryId String @unique; createdAt DateTime @default(now()) }
model Message { id String @id @default(cuid()); threadId String; senderId String; body String @db.Text; createdAt DateTime @default(now()); readAt DateTime? }

// A confirmed stay, recorded by the host (often created from a CONFIRMED inquiry).
model Stay {
  id          String @id @default(cuid())
  listingId   String
  inquiryId   String?           // optional link back
  guestName   String            // denormalized; guest may not be a platform user
  numGuests   Int
  checkinAt   DateTime          // date + time
  checkoutAt  DateTime
  status      StayStatus @default(UPCOMING) // UPCOMING | IN_HOUSE | COMPLETED | CANCELLED
  notes       String? @db.Text
}

model StaffAssignment {
  id          String @id @default(cuid())
  listingId   String
  staffUserId String?           // null until invite accepted by a registered user
  inviteEmail String
  inviteToken String  @unique
  status      AssignmentStatus @default(INVITED) // INVITED | ACTIVE | REVOKED
  createdAt   DateTime @default(now())
  @@unique([listingId, inviteEmail])
}

model PrepSlot {
  id           String @id @default(cuid())
  listingId    String
  staffUserId  String
  outgoingStayId String?        // stay that checks out (gives checkout time)
  incomingStayId String?        // next stay (gives check-in deadline)
  windowStart  DateTime         // = outgoing checkoutAt (or host-set)
  windowEnd    DateTime         // = incoming checkinAt (or host-set)
  status       SlotStatus @default(REQUESTED) // REQUESTED | ACCEPTED | DECLINED | IN_PROGRESS | DONE | CANCELLED
  hostNotes    String? @db.Text
  completedAt  DateTime?
  completionNote String? @db.Text
}

// Logistics — linen tracked as individual sets with a location/state; consumables as levels.
model LinenSet {
  id        String @id @default(cuid())
  listingId String
  type      LinenType   // SHEETS | TOWELS
  label     String      // e.g. "Sheets #3"
  state     LinenState  @default(STORED_CLEAN) // STORED_CLEAN | IN_USE | STORED_DIRTY | AT_LAUNDRY
  updatedById String?
  updatedAt DateTime @updatedAt
}

model Consumable {
  id        String @id @default(cuid())
  listingId String
  name      String        // "Toilet paper", "Hand soap", "Dish soap", ...
  unit      String?       // "rolls", "bottles"
  quantity  Int?          // exact count, OR
  level     StockLevel?   // FULL | OK | LOW | EMPTY (simple mode)
  updatedById String?
  updatedAt DateTime @updatedAt
}

model DamageReport {
  id         String @id @default(cuid())
  listingId  String
  prepSlotId String?
  reporterId String
  description String @db.Text
  photoUrl   String?
  status     ReportStatus @default(OPEN) // OPEN | ACKNOWLEDGED | RESOLVED
  createdAt  DateTime @default(now())
}

model Notification {
  id        String @id @default(cuid())
  userId    String
  type      String       // e.g. "INQUIRY_RECEIVED", "SLOT_REQUESTED", "GUEST_ARRIVING", "SLOT_DONE"
  title     String
  body      String
  link      String?      // in-app deep link
  readAt    DateTime?
  createdAt DateTime @default(now())
}
```

---

## 6. API surface (REST, `/api/...`, JSON, Zod-validated)

| Module | Endpoints (summary) |
|---|---|
| **Auth (M1)** | `POST /api/auth/register`, Auth.js routes for login/logout/session, `DELETE /api/account` (GDPR delete), `GET /api/me` |
| **Listings (M2)** | `GET /api/listings` (public, published only), `GET /api/listings/:id` (public), `POST /api/listings`, `PATCH /api/listings/:id`, `DELETE /api/listings/:id` (soft → ARCHIVED), `POST /api/listings/:id/photos` (multipart, returns URL), `DELETE /api/photos/:id`, `PATCH /api/photos/order`, `GET /api/amenities`, `PUT /api/listings/:id/amenities` |
| **Availability (M3)** | `GET /api/listings/:id/calendar?from&to` (public; merged blocks + prices), `PUT /api/listings/:id/calendar` (host; upsert ranges, server splits/merges overlaps) |
| **Inquiries & messaging (M4)** | `POST /api/listings/:id/inquiries`, `GET /api/inquiries?role=host|guest`, `PATCH /api/inquiries/:id` (status), `GET /api/threads/:id/messages`, `POST /api/threads/:id/messages`, `POST /api/messages/read` |
| **Stays (M5)** | `GET/POST /api/listings/:id/stays`, `PATCH /api/stays/:id`, `POST /api/inquiries/:id/convert-to-stay` |
| **Logistics (M6)** | `GET /api/listings/:id/logistics` (linen + consumables + open damage reports in one payload), `POST/PATCH/DELETE /api/linen-sets/:id`, `PATCH /api/linen-sets/bulk` (state moves), `POST/PATCH /api/consumables/:id`, `POST /api/listings/:id/damage-reports`, `PATCH /api/damage-reports/:id` |
| **Staff & slots (M7)** | `POST /api/listings/:id/staff-invites`, `POST /api/staff-invites/accept` (token), `DELETE /api/staff-assignments/:id`, `POST /api/listings/:id/prep-slots`, `GET /api/prep-slots?role=staff|host`, `PATCH /api/prep-slots/:id` (accept/decline/start), `POST /api/prep-slots/:id/complete` (requires fresh logistics update — see flow) |
| **Notifications (M8)** | `GET /api/notifications`, `POST /api/notifications/read`, internal `notify(userId, type, payload)` service + `sendEmail(template, to, data)` adapter, `POST /api/jobs/daily` (cron, secret-protected) |

**Error contract (all modules):** `{ error: { code: string, message: string, fields?: Record<string,string> } }` with proper HTTP codes. **Success:** `{ data: ... }`.

---

## 7. Key flows

**F1 — Inquiry.** Guest (logged in) opens listing → fills form (dates, nr. of people, comments; name/email come from the account) → `POST /inquiries` → server creates Inquiry + Thread + first Message (rendered from the form), calls `notify(host, INQUIRY_RECEIVED)` → in-app notification + email to host containing the details and a link to the thread. The listing page also shows a **WhatsApp button** (if host set a phone) with prefilled text: listing title, dates, guests. Host replies in the thread; guest gets email + in-app notification.

**F2 — Stay & arrival/departure notifications.** Host confirms an inquiry → "Convert to stay" (sets exact check-in/check-out date-times; also marks the calendar range BOOKED). Daily cron at 07:00: for stays with check-in within 24 h → notify host + staff with an ACCEPTED slot on that listing ("Guest arriving tomorrow 15:00"); same for check-outs. Hourly cron flips Stay status (UPCOMING → IN_HOUSE → COMPLETED).

**F3 — Prep slot.** Host creates a PrepSlot for an ACTIVE staff member, normally linking the outgoing and incoming stays (window auto-computed) → staff gets notification + email → staff **accepts or declines**. If accepted: staff sees the slot with checkout/check-in times and live logistics snapshot. On the day, staff opens the slot → updates linen states and consumable levels → optionally files damage report → presses **Done** (server requires that linen + consumables for that listing were updated after `windowStart`; otherwise it prompts) → slot status DONE, `completedAt` set → host notified "Slot done — proceed to payment" (payment itself is off-platform in beta).

**F4 — Staff invite.** Host enters staff email → `StaffAssignment` row with token → email with accept link → recipient registers (or logs in) → `POST /staff-invites/accept` binds `staffUserId`, status ACTIVE.

---

## 8. Repository structure (ownership map)

```
staybase/
├── prisma/schema.prisma            # Agent A (others append via migrations)
├── src/
│   ├── lib/
│   │   ├── auth/                   # Agent A — session, guards
│   │   ├── db.ts                   # Agent A — Prisma client
│   │   ├── validation/             # per-module Zod schemas (owned by each agent)
│   │   ├── email/                  # Agent A skeleton; templates added per module
│   │   └── notify.ts               # Agent G — notification service
│   ├── modules/                    # backend service layer, one folder per module
│   │   ├── listings/  availability/  inquiries/  stays/
│   │   ├── logistics/  staff/  notifications/
│   ├── app/
│   │   ├── (public)/               # Agent D — catalog, listing detail, auth pages
│   │   ├── (guest)/inquiries/      # Agent F
│   │   ├── (host)/host/...         # Agents C, E, F, G, H, I (separate route folders)
│   │   ├── (staff)/staff/...       # Agent I
│   │   └── api/...                 # API routes, per module
│   └── components/ui/              # Agent B — shared design system
├── e2e/                            # Agent J
└── docker/ or vercel.json          # Agent J
```

---

## 9. Build order & dependency graph

```
Phase 0  Agent A (foundation: scaffold, schema, auth)  ──┐
Phase 0  Agent B (UI kit & app shell)                  ──┤  must finish first
Phase 1  Agents C (listings mgmt), E (calendar), G-(schema part of stays)   — parallel
Phase 2  Agents D (public site), F (inquiries/messaging), G (stays+notifications), H (logistics) — parallel
Phase 3  Agent I (staff portal & prep slots — consumes G + H)
Phase 4  Agent J (integration, seed data, E2E, deployment)
```

Merge discipline: each agent works on a feature branch, touches only its owned folders plus additive Prisma migrations, and must keep `npm run build && npm run lint && npx prisma validate` green.

---

## 10. Subagent prompts

Paste the **shared context block** at the top of every subagent prompt, then the agent-specific prompt. Attach (or make available in the repo) `prisma/schema.prisma`, the API table from §6, and the error/success contract.

### 10.0 Shared context block (prepend to every prompt)

```text
PROJECT CONTEXT — StayBase (apartment rental portal, beta)
You are one of several developers building a single Next.js 14+ (App Router, TypeScript) modular monolith.
Stack: React, Tailwind CSS, shadcn/ui, Prisma + PostgreSQL, Auth.js (credentials + bcrypt), Zod, Resend for email, Leaflet/OSM for maps.
Three roles: guests (browse + inquire), hosts (manage listings, staff, logistics), staff (prep slots, inventory).
No payments, no search, no reviews in this version.

HARD RULES (violating these breaks the merge):
1. The Prisma schema in prisma/schema.prisma is the source of truth. You may ADD models/fields via a new migration in your own namespace; never modify or delete another module's models. If you believe a change to a shared model is required, add a comment block `// PROPOSED-CHANGE:` and stop — do not apply it.
2. Only create/edit files inside your OWNED PATHS (listed in your task). Shared files you may import but not edit: src/lib/db.ts, src/lib/auth/*, src/components/ui/*, src/lib/notify.ts.
3. All API routes: validate input with Zod, return { data } on success and { error: { code, message, fields? } } on failure with correct HTTP status. Enforce authorization with the provided guards: requireAuth, requireListingOwner, requireListingStaff, requireParticipant.
4. Server-side logic lives in src/modules/<your-module>/service.ts; API route handlers stay thin.
5. UI: use components from src/components/ui only; responsive (mobile-first); no inline hex colors — use the Tailwind theme tokens.
6. Every endpoint and service function gets at least one Vitest test (happy path + one auth failure).
7. `npm run build`, `npm run lint`, `npm run test`, `npx prisma validate` must pass before you finish.
8. Document your module in src/modules/<module>/README.md: endpoints, service functions, events you emit via notify(), assumptions.
9. Dates: store UTC; all check-in/check-out and slot windows are DateTime; calendar ranges use checkout-style exclusive end dates. Currency default EUR.
10. Never log passwords, tokens, or message bodies.
```

### Agent A — Foundation: scaffold, database schema, auth

```text
TASK: Create the project foundation that all other developers build on.
OWNED PATHS: repo root config, prisma/, src/lib/db.ts, src/lib/auth/**, src/lib/email/**, src/lib/validation/common.ts, src/app/api/auth/**, src/app/api/me, src/app/api/account.

Deliverables:
1. Scaffold Next.js 14+ App Router project (TypeScript, ESLint, Tailwind, Vitest, src/ layout as in the repo map). Add npm scripts: dev, build, lint, test, db:migrate, db:seed.
2. Implement prisma/schema.prisma EXACTLY as specified in the architecture document (§5), including all enums. Generate the initial migration. Provide src/lib/db.ts exporting a singleton PrismaClient.
3. Auth: Auth.js credentials provider. POST /api/auth/register accepts { name, email, password, phone?, isHost?, consent: true }; bcrypt hash (cost 12); reject weak passwords (<8 chars); unique-email error as fields error. JWT session cookie (httpOnly, Secure, SameSite=Lax). GET /api/me returns the session user. DELETE /api/account deletes the user and anonymizes their messages/inquiries (GDPR).
4. Authorization guards in src/lib/auth/guards.ts: requireAuth(), requireListingOwner(listingId), requireListingStaff(listingId) (owner also passes), requireParticipant(threadId). Each returns the user or throws a typed 401/403 error that route handlers map to the error contract.
5. Email adapter src/lib/email/send.ts: sendEmail({ to, template, data }) using Resend, with a console transport fallback when RESEND_API_KEY is missing. Include one base layout template.
6. .env.example with DATABASE_URL, AUTH_SECRET, RESEND_API_KEY, APP_URL, CRON_SECRET.
7. Seed script with 12 default amenities (WiFi, Kitchen, Washer, Parking, Heating, AC, TV, Elevator, Balcony, Workspace, Crib, Dishwasher).

Acceptance: register → login → GET /api/me round-trip works; guards unit-tested; build/lint/test green.
```

### Agent B — UI kit & application shell

```text
TASK: Build the shared design system and the three portal shells so feature developers only fill in pages.
OWNED PATHS: src/components/ui/**, src/components/layout/**, src/app/(public)/layout.tsx, src/app/(host)/layout.tsx, src/app/(staff)/layout.tsx, src/app/(guest)/layout.tsx, tailwind.config, global styles.

Deliverables:
1. Tailwind theme: neutral palette + one accent color, spacing/typography scale, dark-mode-ready tokens.
2. Components (typed props, responsive, accessible): Button, Input, Textarea, Select, DatePicker + DateRangePicker, Modal, Drawer, Toast, Card, Badge, Tabs, Table, EmptyState, Spinner, Avatar, ImageGallery (lightbox), Stepper, ConfirmDialog, NotificationBell (renders a list passed via props), StatusPill (maps enum → color).
3. Layouts: (public) top nav with login/register or user menu; (host) sidebar nav: Listings, Inquiries, Calendar, Stays, Logistics, Staff; (staff) simple top-tab nav: My slots, Listings I manage; shared footer with privacy-policy link.
4. A /styleguide dev-only page rendering every component.
5. Role-based redirect helper: after login, hosts land on /host, staff (with ≥1 active assignment) on /staff, others on /.

Acceptance: styleguide page renders all components in mobile (375px) and desktop widths without overflow; no feature logic included.
```

### Agent C — Listing management (host side)

```text
TASK: Hosts create and manage listings: publish, photos, description, amenities, optional location pin or general area, delete.
OWNED PATHS: src/modules/listings/**, src/app/api/listings/** (except /calendar, /inquiries, /stays, /staff-invites, /prep-slots subroutes), src/app/api/photos/**, src/app/api/amenities/**, src/app/(host)/host/listings/**.

Deliverables:
1. Service + API per §6: listing CRUD (delete = status ARCHIVED, blocked while an UPCOMING/IN_HOUSE stay exists — return error code LISTING_HAS_ACTIVE_STAYS), publish requires: title, description ≥ 50 chars, ≥1 photo, addressText, basePricePerNight > 0.
2. Photo upload: multipart endpoint → validate type (jpeg/png/webp) and size ≤ 10 MB → resize to 1600px + 400px thumb (sharp) → store via the storage adapter (implement src/lib/storage.ts with S3-compatible driver and local-disk fallback for dev) → ListingPhoto row. Reorder + set-cover + delete endpoints.
3. Amenities: GET catalog, PUT replace set for a listing.
4. Location: host chooses EXACT (draggable Leaflet pin) or AREA (addressText + approximate point shown as a 500 m circle). lat/lng optional overall.
5. Host UI at /host/listings: list with status badges; create/edit wizard (Details → Photos → Amenities → Location → Pricing basics → Review & publish); archive with ConfirmDialog.

Acceptance: full create→publish→edit→archive cycle works in the browser; non-owners get 403 (tested).
```

### Agent D — Public catalog & listing detail (guest side)

```text
TASK: The public-facing site: list of published listings and the listing detail page.
OWNED PATHS: src/app/(public)/page.tsx, src/app/(public)/listings/**, src/modules/catalog/**.

Deliverables:
1. Home page: grid of PUBLISHED listings (cover photo, title, addressText, price "from €X/night", max guests). No search/filters — just the list (SSR, cached 60 s).
2. Listing detail /listings/[id]: ImageGallery, description, amenity icons, max guests/bedrooms, map (exact pin or area circle per locationPrecision; omit map if no coordinates), availability & price calendar (read-only month view consuming GET /api/listings/:id/calendar — coordinate with Agent E's response shape), "Send inquiry" button → inquiry form (Agent F's component at a defined mount point; render a placeholder <InquiryEntry listingId/> you import from src/modules/inquiries/ui — stub it if not merged yet), WhatsApp button (only when host phone exists) linking to wa.me with prefilled title + selected dates.
3. Logged-out users clicking "Send inquiry" are routed to login with returnTo.
4. SEO: per-listing metadata + OpenGraph image (cover photo).

Acceptance: Lighthouse mobile performance ≥ 85 on the detail page with seed data; calendar renders the exact data returned by the calendar API.
```

### Agent E — Availability & pricing calendar

```text
TASK: Hosts manage availability and nightly prices as date ranges; everyone can read a merged calendar.
OWNED PATHS: src/modules/availability/**, src/app/api/listings/[id]/calendar/**, src/app/(host)/host/calendar/**.

Deliverables:
1. GET /api/listings/:id/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD (public): returns days[] with { date, status: AVAILABLE|BLOCKED|BOOKED, price } — price = block override or listing base price; absence of a block = AVAILABLE. Cap range at 18 months.
2. PUT /api/listings/:id/calendar (owner): body { ranges: [{ startDate, endDate, status, nightlyPrice? }] }. Server normalizes: splits/merges overlapping AvailabilityBlock rows so blocks never overlap; BOOKED ranges can only be written by the stays module (service-level flag) — hosts mark BOOKED indirectly by creating stays; hosts CAN unblock past mistakes. Reject endDate <= startDate.
3. Service functions exported for other modules: setBooked(listingId, start, end, tx), releaseBooked(...), isRangeAvailable(listingId, start, end) — Agent G consumes these inside a transaction.
4. Host UI /host/calendar: listing selector; month grid; drag-select a range → popover: Available (with price input) / Blocked; legend; shows BOOKED read-only.

Acceptance: property-based test that arbitrary sequences of range writes never produce overlapping blocks; public calendar matches host edits immediately.
```

### Agent F — Inquiries & messaging (email + WhatsApp + in-app threads)

```text
TASK: Guests inquire about a listing; hosts and guests message each other; every inquiry/message triggers email + in-app notification.
OWNED PATHS: src/modules/inquiries/**, src/app/api/listings/[id]/inquiries/**, src/app/api/inquiries/**, src/app/api/threads/**, src/app/api/messages/**, src/app/(guest)/inquiries/**, src/app/(host)/host/inquiries/**, email templates inquiry-*.tsx.

Deliverables:
1. POST /api/listings/:id/inquiries (auth required): { checkinDate, checkoutDate, numGuests, comments? }. Validate: listing PUBLISHED, checkin >= today, checkout > checkin, 1 <= numGuests <= listing.maxGuests (warn-but-allow above? NO — reject with NUM_GUESTS_EXCEEDED). Creates Inquiry + Thread + first Message (formatted summary incl. guest name, dates, guests, comments). Calls notify(hostId, 'INQUIRY_RECEIVED', ...) and sends email to the host with the details + thread link. Rate-limit: max 5 inquiries/user/day.
2. Thread messaging: GET messages (participants only — guard requireParticipant), POST message → notify + email to the other party (email batching: at most one email per thread per 15 min; in-app always). Mark-read endpoint.
3. Inquiry status: host can set ANSWERED, DECLINED, CONFIRMED, CLOSED. CONFIRMED exposes a "Convert to stay" button (calls Agent G's endpoint — just link to it).
4. <InquiryEntry listingId> UI component (exported from src/modules/inquiries/ui) used by the public listing page: opens modal with the form, prefilled with dates selected on the calendar if provided via props.
5. Inbox UIs: guest /inquiries (their inquiries + threads), host /host/inquiries (filter by listing/status, unread badge). Chat-style thread view.
6. Email templates: inquiry-received (to host), inquiry-reply (both directions) — include listing title, dates, guest count, deep link.

Acceptance: end-to-end test guest-inquires→host-replies→guest-reads; emails captured by console transport contain correct data; non-participants get 403.
```

### Agent G — Stays, scheduler & notification service

```text
TASK: Confirmed stays with check-in/check-out date-times; the notification service used by ALL modules; cron jobs for arrival/departure alerts.
OWNED PATHS: src/modules/stays/**, src/modules/notifications/**, src/lib/notify.ts, src/app/api/listings/[id]/stays/**, src/app/api/stays/**, src/app/api/inquiries/[id]/convert-to-stay, src/app/api/notifications/**, src/app/api/jobs/**, src/app/(host)/host/stays/**, email templates stay-*.tsx.

Deliverables:
1. Notification service src/lib/notify.ts: notify(userId, type, { title, body, link }) → inserts Notification row; optional email flag per type (map in one config object). GET /api/notifications (paginated, unreadCount), POST /api/notifications/read. Wire the NotificationBell component (Agent B) into all three layouts via a small provider that polls every 30 s.
2. Stays CRUD (host only): create manually or via POST /api/inquiries/:id/convert-to-stay (copies dates/guest, asks for exact times; default check-in 15:00, check-out 11:00 local — store UTC, listing-level defaults configurable later). On create: call availability.setBooked() in the same transaction; on cancel: releaseBooked(). Overlapping stays on a listing → error STAY_OVERLAP.
3. Cron endpoints protected by CRON_SECRET header:
   - POST /api/jobs/daily (07:00): for each Stay checking in within the next 24h → notify host + every staff member holding an ACCEPTED PrepSlot on that listing whose window touches that date: 'GUEST_ARRIVING'. Same for check-outs: 'GUEST_LEAVING'. Idempotent (record lastNotifiedAt fields you add to Stay via migration).
   - POST /api/jobs/hourly: flip Stay.status UPCOMING→IN_HOUSE at checkinAt, IN_HOUSE→COMPLETED at checkoutAt.
4. Host UI /host/stays: upcoming/past list per listing, create/edit/cancel, link to create a prep slot for the gap after each stay (button linking to Agent I's route with stay ids as query params).
5. Email templates: guest-arriving, guest-leaving (to host and to assigned staff).

Acceptance: unit tests for idempotent cron logic with fake timers; converting an inquiry books the calendar atomically (transaction tested).
```

### Agent H — Logistics & inventory (linen, consumables, damage reports)

```text
TASK: Per-listing inventory: linen sets with states, consumable stock levels, damage reports. Used by hosts and staff.
OWNED PATHS: src/modules/logistics/**, src/app/api/listings/[id]/logistics/**, src/app/api/linen-sets/**, src/app/api/consumables/**, src/app/api/listings/[id]/damage-reports/**, src/app/api/damage-reports/**, src/app/(host)/host/logistics/**, plus a reusable <LogisticsPanel listingId readonly?> component exported from src/modules/logistics/ui.

Deliverables:
1. GET /api/listings/:id/logistics → one payload: linenSets grouped by type with counts per state (e.g. sheets: 2 clean / 1 in use / 1 laundry), consumables with quantity or level + updatedAt + updatedBy name, open damage reports. Access: owner or active staff.
2. Linen sets: create (type, label auto-suggested "Sheets #n"), rename, delete; PATCH state per set; PATCH /api/linen-sets/bulk { ids, state } for fast "all dirty → laundry" moves. Track updatedById.
3. Consumables: CRUD; each item uses EITHER quantity (int, +/- steppers) OR level (FULL/OK/LOW/EMPTY pills) — chosen at creation. Seed defaults on listing publish (hook exposed as logistics.seedDefaults(listingId), called by listings module — coordinate: Agent C calls it; if not yet wired, expose a "Add default items" button): Toilet paper (rolls, quantity), Hand soap, Dish soap, Sponges, Trash bags.
4. Damage reports: create with description + optional photo (reuse storage adapter), host can ACKNOWLEDGE/RESOLVE; notify(host, 'DAMAGE_REPORTED') on creation.
5. <LogisticsPanel> component: mobile-first, big tap targets (staff use phones), state pills with color coding (clean=green, in use=blue, dirty=amber, laundry=purple; low/empty=red), inline +/- steppers, "last updated by X, 2h ago" lines. readonly mode for dashboards.
6. Host UI /host/logistics: listing selector + LogisticsPanel + damage report inbox. Expose service helper logistics.lastUpdatedAt(listingId) → { linenAt, consumablesAt } for Agent I's Done-check.

Acceptance: bulk state move of 10 sets in one request; staff of listing A cannot read listing B (tested); panel usable one-handed at 375px width.
```

### Agent I — Staff portal & preparation slots

```text
TASK: Staff invitations, prep-slot lifecycle (request → accept/decline → in progress → done), and the staff portal UI.
OWNED PATHS: src/modules/staff/**, src/app/api/listings/[id]/staff-invites/**, src/app/api/staff-invites/**, src/app/api/staff-assignments/**, src/app/api/listings/[id]/prep-slots/**, src/app/api/prep-slots/**, src/app/(staff)/**, src/app/(host)/host/staff/**, email templates staff-*.tsx.
DEPENDS ON: Agent G's notify() + stays, Agent H's LogisticsPanel + lastUpdatedAt.

Deliverables:
1. Invites (flow F4): host posts an email → StaffAssignment(INVITED, token, 7-day expiry) + email with accept link /staff/accept?token=...; accepting requires login/registration with ANY email (token is the credential; store the accepting user). Host can revoke (REVOKED hides listing from staff). Host UI /host/staff: per-listing staff list + invite form + revoke.
2. Prep slots (flow F3): host creates slot for an ACTIVE staff member; optional links to outgoingStay/incomingStay auto-fill windowStart=checkoutAt, windowEnd=checkinAt (manual times allowed; validate windowEnd > windowStart). On create: notify + email staff 'SLOT_REQUESTED' with date, window, listing, host notes.
3. Staff actions: PATCH accept/decline (only the assignee; only from REQUESTED). Accepted slots subscribe the staff member to that listing's arrival/departure notifications (Agent G reads ACCEPTED slots — verify integration). Staff can mark IN_PROGRESS.
4. Done flow: POST /api/prep-slots/:id/complete { completionNote? } → server checks logistics.lastUpdatedAt(listingId): BOTH linen and consumables updated after windowStart, else 409 LOGISTICS_NOT_UPDATED with a friendly message ("Update linen and supplies before finishing"). On success: status DONE, completedAt=now, notify(host, 'SLOT_DONE', body incl. completion note) — host proceeds to pay off-platform.
5. Staff portal /staff: "My slots" (pending requests with Accept/Decline, upcoming accepted with countdown 'X h between checkout and check-in', in-progress with embedded <LogisticsPanel> + damage-report button + Done button), "Listings I manage" (read-only logistics view). Mobile-first.
6. Email templates: staff-invite, slot-requested, slot-done (to host).

Acceptance: full E2E happy path invite→accept→slot→accept→update logistics→Done; Done blocked until logistics updated (tested); declined slot notifies host.
```

### Agent J — Integration, seed data, E2E tests & deployment

```text
TASK: Merge all modules, prove the product works end-to-end, and ship it.
OWNED PATHS: e2e/**, prisma/seed.ts (extend), docker/**, vercel.json, .github/workflows/**, README.md, /privacy page.

Deliverables:
1. Integration pass: resolve module wiring marked as coordination points — Agent C calls logistics.seedDefaults on publish; public listing page mounts <InquiryEntry>; stays↔calendar transaction; cron jobs scheduled (Vercel Cron or node-cron: daily 07:00 Europe/Berlin, hourly). Fix type/lint conflicts WITHOUT changing module behavior; file issues for anything bigger.
2. Demo seed: 1 host (host@demo.test / Password123!), 2 published listings with photos (use placeholder images), amenities, mixed calendars, 1 guest, 1 staff (accepted), 1 open inquiry with thread, 1 upcoming stay, 1 accepted prep slot, populated logistics.
3. Playwright E2E suite covering: register/login; browse→detail→inquiry→host reply; host creates listing→publish; calendar edit reflected publicly; convert inquiry→stay→calendar BOOKED; invite staff→accept; slot accept→logistics update→Done blocked/unblocked; account deletion.
4. CI (GitHub Actions): lint, unit tests, prisma validate, build, E2E against a Postgres service container.
5. Deployment, Option A: Vercel project + Supabase (EU region) for Postgres/storage, env vars documented, Vercel Cron config. Option B: docker-compose.yml (app, postgres with encrypted volume, Caddy for TLS), backup cron (pg_dump nightly to storage). Implement the option specified by the project owner; document both briefly in README.
6. Security pass: headers (CSP, HSTS), rate limiting on auth + inquiry endpoints, verify CRON_SECRET, confirm no secrets in client bundles.
7. /privacy static page (data collected, purpose, deletion contact) linked in the footer.

Acceptance: green CI; fresh clone → `cp .env.example .env && docker compose up` (or vercel deploy) → seeded demo flows clickable end-to-end.
```

---

## 11. Coordination points (the merge checklist)

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

## 12. Suggested post-beta roadmap (parked deliberately)

Payments & staff payouts (Stripe Connect), regional search + filters, real booking with payment-confirmed reservations, iCal sync with Airbnb/Booking, reviews, push notifications (PWA), WhatsApp Business API, multi-language (DE/EN), host analytics.
