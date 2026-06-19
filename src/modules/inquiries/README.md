# Inquiries module

Handles the full lifecycle of a guest inquiry: creation, threaded messaging, status transitions, and notifications.

## Owned paths

- `src/modules/inquiries/**` — service, validation, pricing, UI export
- `src/app/api/inquiries/**` — REST endpoints for inquiry CRUD and status updates
- `src/app/api/threads/**` — thread message read/write
- `src/app/api/messages/**` — mark-read endpoint
- `src/app/(guest)/inquiries/**` — guest inbox and thread view
- `src/app/(host)/host/inquiries/**` — host inbox and thread view
- `src/components/inquiries/thread-view.tsx` — shared chat component
- Email templates: `src/lib/email/templates/inquiry-new.tsx`, `inquiry-reply.tsx`

## Data model

```
Inquiry  1──1  Thread  1──∞  Message
```

- **Inquiry** — links a guest to a listing, holds dates, guest count, and lifecycle status.
- **Thread** — one-to-one with Inquiry; the conversation container.
- **Message** — a single chat entry; `readAt` is set when the recipient polls/views the thread.

## Status lifecycle

```
OPEN → ANSWERED → CONFIRMED ──► (create Stay)
                └─► DECLINED
     └─────────────────────────► CLOSED
```

Only the host can change status. The service auto-advances `OPEN → ANSWERED` when the host posts their first message.

## Key service functions

| Function | Description |
|---|---|
| `createInquiry(guestId, input)` | Create inquiry + thread + first message; notify host by email |
| `getGuestInquiries(guestId)` | All inquiries for a guest, newest first |
| `getHostInquiries(hostId, listingId?, status?)` | All inquiries across host's listings, filterable |
| `getThread(threadId, userId)` | Full thread with messages; validates participant |
| `getThreadByInquiry(inquiryId, userId)` | Host path — look up thread via inquiryId |
| `postThreadMessage(threadId, senderId, body)` | Append message; notify other party in-app + email |
| `markThreadRead(threadId, userId)` | Set `readAt` on unread messages not sent by userId |
| `updateInquiryStatus(inquiryId, status, userId)` | Host-only status change |

## Public UI export

`InquiryEntry` in `src/modules/inquiries/ui.tsx` is the component consumed by the public listing detail page (Agent D). It wraps `InquiryForm` and exposes the same props.

## Authorization

All API routes use guards from `src/lib/auth/guards`:
- `requireAuth()` — any authenticated user
- `requireListingOwner(listingId)` — only the listing host (used for status PATCH)
- Participant check inside `getThread` — throws 403 if caller is neither guest nor host

## Notifications

Each new inquiry and each new message creates a `Notification` row for the recipient (type `INQUIRY_RECEIVED` or `THREAD_MESSAGE`) and fires a non-blocking email via `sendEmail`.
