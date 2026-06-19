# Logistics module (Agent H)

Per-listing inventory management: linen sets with state tracking, consumable stock levels, and damage reports.

## Owned paths

- `src/modules/logistics/**` — service, validation, `<LogisticsPanel>` UI component
- `src/app/api/listings/[id]/logistics` — GET full snapshot
- `src/app/api/linen-sets/**` — create, patch state, bulk-patch, delete
- `src/app/api/consumables/**` — create, patch, delete
- `src/app/api/listings/[id]/damage-reports` — create
- `src/app/api/damage-reports/[id]` — acknowledge / resolve
- `src/app/(host)/host/logistics/**` — host UI

## Service functions

| Function | Description |
|---|---|
| `getLogistics(listingId, userId)` | Full snapshot: linenSets + consumables + open damage reports. Host or active staff only. |
| `lastUpdatedAt(listingId)` | `{ linenAt, consumablesAt }` — consumed by Agent I's Done check |
| `seedDefaults(listingId)` | Creates 5 default consumables if none exist. Idempotent. Called by host logistics page and by Agent C on publish. |
| `createLinenSet(listingId, userId, input)` | Creates a linen set (auto-labels "Sheets #n" if label empty) |
| `updateLinenState(setId, userId, input)` | Changes state of a single set, tracks `updatedById` |
| `bulkUpdateLinenState(listingId, userId, input)` | Moves multiple sets to a state in one DB call |
| `deleteLinenSet(setId, userId)` | Removes a set |
| `createConsumable(listingId, userId, input)` | Adds a consumable in quantity or level mode |
| `updateConsumable(id, userId, input)` | Updates quantity/level; tracks `updatedById` via `updatedAt` auto-update |
| `deleteConsumable(id, userId)` | Removes a consumable |
| `createDamageReport(listingId, userId, input, prepSlotId?)` | Creates a OPEN report; notifies host by email+in-app if reporter is staff |
| `updateDamageReport(reportId, userId, input)` | Host only; status → ACKNOWLEDGED or RESOLVED |

## `<LogisticsPanel>` component

Exported from `src/modules/logistics/ui.tsx`. Consumed by:
- Host logistics page (with `readonly=false`)
- Staff portal (with `readonly=false`, `prepSlotId` for damage report attribution)

Props:
```typescript
{
  listingId: string
  initialData: LogisticsPanelData   // linenSets, consumables, damageReports
  readonly?: boolean
  prepSlotId?: string               // optional: tag damage reports to a prep slot
}
```

## Linen state machine

```
STORED_CLEAN → IN_USE → STORED_DIRTY → AT_LAUNDRY → STORED_CLEAN
```

Any transition is allowed (hosts/staff may fix mistakes). States are UI-pill cycled; bulk moves supported (select checkboxes → target state).

## Consumable modes

Chosen at creation time (cannot change mode later without deleting and recreating):
- **quantity** — integer with +/− steppers and unit label (e.g. "12 rolls")
- **level** — four-pill selector: FULL / OK / LOW / EMPTY

## Authorization

All endpoints check that the caller is either the listing host or has an ACTIVE `StaffAssignment` for the listing. Damage report acknowledgement/resolution is host-only.
