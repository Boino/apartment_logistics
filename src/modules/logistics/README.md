# Logistics module (Agent H)

Per-listing inventory management: linen sets with state tracking, linen bundle kits (PAR-level tracking), consumable stock levels with restock alerts, and damage reports.

## Owned paths

- `src/modules/logistics/**` — service, validation, `<LogisticsPanel>` UI component
- `src/app/api/listings/[id]/logistics` — GET full snapshot (includes bundles + alerts)
- `src/app/api/listings/[id]/linen-bundles` — GET list + POST create bundle template
- `src/app/api/linen-bundles/[id]` — PATCH + DELETE bundle template (host only)
- `src/app/api/linen-bundles/[id]/instances` — GET list + POST create instance
- `src/app/api/linen-bundle-instances/[id]` — PATCH state + DELETE instance
- `src/app/api/linen-bundle-instances/bulk` — PATCH bulk state move
- `src/app/api/linen-sets/**` — create, patch state, bulk-patch, delete
- `src/app/api/consumables/**` — create, patch (now incl. parTarget/reorderThreshold), delete
- `src/app/api/listings/[id]/damage-reports` — create
- `src/app/api/damage-reports/[id]` — acknowledge / resolve
- `src/app/(host)/host/logistics/**` — host UI

## Service functions

### Existing (unchanged)

| Function | Description |
|---|---|
| `getLogistics(listingId, userId)` | Full snapshot: linenSets, consumables (+ needsRestock), damageReports, linenBundles (+ belowPar), alerts. Host or active staff only. |
| `lastUpdatedAt(listingId)` | `{ linenAt, consumablesAt }` — now also counts bundle instance updates under linenAt. Consumed by Agent I's Done check. |
| `seedDefaults(listingId)` | Creates 5 default consumables if none exist. Idempotent. |
| `createLinenSet / updateLinenState / bulkUpdateLinenState / deleteLinenSet` | Individual linen piece management. |
| `createConsumable / updateConsumable / deleteConsumable` | Consumable CRUD. `updateConsumable` now accepts `parTarget` and `reorderThreshold`. |
| `createDamageReport / updateDamageReport` | Damage report lifecycle. |

### New (bundle kit management)

| Function | Description |
|---|---|
| `getBundleTemplates(listingId, userId)` | List all templates for a listing; includes instance count. |
| `createBundleTemplate(listingId, userId, input)` | Host-only. Parses `components` array to JSON string. `parTarget` 1–20. |
| `updateBundleTemplate(templateId, userId, input)` | Host-only. Partial update. |
| `deleteBundleTemplate(templateId, userId)` | Host-only. Throws `BUNDLE_TEMPLATE_IN_USE` (409) if instances exist. |
| `getBundleInstances(templateId, userId)` | List all instances; includes linked linen pieces. |
| `createBundleInstance(templateId, userId, input)` | Host or active staff. Creates a physical kit row. |
| `updateBundleInstanceState(instanceId, userId, input)` | Host or active staff. State machine: STORED_CLEAN ↔ IN_USE ↔ STORED_DIRTY ↔ AT_LAUNDRY (any transition allowed). |
| `bulkUpdateBundleInstanceState(listingId, userId, input)` | Host or active staff. Same as bulk linen sets. |
| `deleteBundleInstance(instanceId, userId)` | Host or active staff. Unlinks any attached linen pieces first. |
| `convertPiecesToBundle(listingId, pieceIds, templateId, label)` | Groups existing `LinenSet` rows into a new `LinenBundleInstance`. |

## Data model additions (migration: `logistics_bundles_and_thresholds`)

### New models

**`LinenBundleTemplate`** — kit definition per listing.
- `parTarget Int @default(3)` — desired number of STORED_CLEAN instances (PAR level).
- `components String` — JSON-encoded `[{itemType: string, quantity: number}]`.

**`LinenBundleInstance`** — one physical kit in circulation. Shares the same state values as `LinenSet`.

### Extended fields

**`LinenSet`**
- `bundleInstanceId String?` — optional FK to `LinenBundleInstance` (piece tracking can optionally belong to a bundle).

**`Consumable`**
- `parTarget Int?` — desired stock level (for display/reference).
- `reorderThreshold Int?` — quantity at or below which `needsRestock = true` is computed (quantity-mode only).

## Computed fields (returned by `getLogistics`)

**Per consumable:**
- `needsRestock: boolean`
  - Level mode: `true` when `level === 'LOW' || level === 'EMPTY'`
  - Quantity mode: `true` when `quantity !== null && reorderThreshold !== null && quantity <= reorderThreshold`

**Per bundle template:**
- `belowPar: boolean` — `count(STORED_CLEAN instances) < parTarget`
- `counts` — `{ STORED_CLEAN, IN_USE, STORED_DIRTY, AT_LAUNDRY, total }`

**Top-level:**
- `alerts: Array<{ type: 'BELOW_PAR'|'NEEDS_RESTOCK', name: string, detail: string }>`

## Authorization

| Action | Required access |
|---|---|
| Read logistics snapshot | Host or active staff |
| Template create / update / delete | Host only |
| Instance create / update state / delete | Host or active staff |
| Damage report acknowledge / resolve | Host only |

## Linen state machine

```
STORED_CLEAN → IN_USE → STORED_DIRTY → AT_LAUNDRY → STORED_CLEAN
```

Any transition is allowed (hosts/staff may correct mistakes). Applies identically to `LinenSet` and `LinenBundleInstance`.

## Industry context (PAR levels)

PAR (Periodic Automatic Replenishment) level is the standard metric in hospitality:
- **PAR 3** = one set in use, one at laundry, one clean standby.
- `belowPar = true` alerts the host that there are fewer clean sets than the target, prompting a laundry pickup.
