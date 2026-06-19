# Stays module (Agent G)

Handles confirmed guest stays, the global notification service, and scheduled cron jobs.

## Owned paths

- `src/lib/notify.ts` — global `notify()` service (consumed by all modules)
- `src/modules/stays/**` — stay service, validation
- `src/modules/notifications/**` — `NotificationWidget` client component
- `src/app/api/listings/[id]/stays/**` — list + create stays for a listing
- `src/app/api/stays/[id]` — update + cancel a stay
- `src/app/api/inquiries/[id]/convert-to-stay` — convert confirmed inquiry
- `src/app/api/notifications/**` — get notifications + mark read
- `src/app/api/jobs/daily` + `hourly` — cron endpoints
- `src/app/(host)/host/stays/**` — host UI

## Notification service (`src/lib/notify.ts`)

```typescript
notify(userId: string, type: string, payload: {
  title: string
  body: string
  link?: string
  email?: { to: string; subject: string; html: string }
})
```

Creates a `Notification` row. Optionally fires an email via `sendEmail` (non-blocking — errors are swallowed and logged).

**Types emitted:** `STAY_CONFIRMED`, `GUEST_ARRIVING`, `GUEST_LEAVING` (by this module); `INQUIRY_RECEIVED`, `THREAD_MESSAGE` (by inquiries module); `DAMAGE_REPORTED`, `SLOT_REQUESTED`, `SLOT_DONE` (by logistics/staff modules).

## Stay lifecycle

```
UPCOMING → IN_HOUSE (at checkinAt, via hourly cron)
IN_HOUSE → COMPLETED (at checkoutAt, via hourly cron)
UPCOMING/IN_HOUSE → CANCELLED (manual host action)
```

On create/convert: `AvailabilityBlock` with status `BOOKED` is created in the same transaction.
On cancel: the BOOKED block is deleted via `releaseBooked()`.

## Service functions

| Function | Description |
|---|---|
| `createStay(userId, input)` | Validates no overlap, creates stay + BOOKED block in transaction |
| `updateStay(stayId, userId, input)` | Host only; re-books calendar if dates change |
| `cancelStay(stayId, userId)` | Sets CANCELLED, releases availability block |
| `convertInquiryToStay(inquiryId, userId, input)` | Sets inquiry → CONFIRMED, creates stay atomically |
| `getListingStays(listingId, userId)` | Host only, ordered by checkinAt |
| `runHourlyCron()` | Flips UPCOMING→IN_HOUSE and IN_HOUSE→COMPLETED |
| `runDailyCron()` | Sends GUEST_ARRIVING + GUEST_LEAVING notifications (idempotent per day) |

## Cron endpoints

Protected by `x-cron-secret` header matching `CRON_SECRET` env var.

- `POST /api/jobs/hourly` — status flips; call every hour
- `POST /api/jobs/daily` — arrival/departure notifications; call daily at 07:00

Idempotency: daily cron checks for existing notifications of the same type on the same day before creating new ones.

## Availability integration

Calls `setBooked`/`releaseBooked` from `src/modules/availability/service.ts`. Overlap check uses a direct DB query rather than the availability module to stay within a single transaction.
