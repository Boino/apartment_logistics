'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Plus, Trash2, AlertTriangle } from 'lucide-react'
import { BundlesView, type BundleEntry } from './logistics-bundles'
import { ConsumablesView, type ConsumableLocal } from './logistics-consumables'

// ── Types ─────────────────────────────────────────────────────────────────────

type LinenSet = {
  id: string; type: string; label: string; state: string
  updatedBy: { name: string } | null; updatedAt: string | Date
}
type DamageReport = {
  id: string; description: string; status: string; photoUrl: string | null; createdAt: string | Date
  reporter: { name: string } | null
}
type LogisticsAlert = { type: 'BELOW_PAR' | 'NEEDS_RESTOCK'; name: string; detail: string }

export interface LogisticsPanelData {
  linenSets: LinenSet[]
  consumables: ConsumableLocal[]
  damageReports: DamageReport[]
  linenBundles?: BundleEntry[]
  alerts?: LogisticsAlert[]
}

interface LogisticsPanelProps {
  listingId: string
  initialData: LogisticsPanelData
  readonly?: boolean
  prepSlotId?: string
}

// ── Linen state config ─────────────────────────────────────────────────────────

const LINEN_STATE_CONFIG: Record<string, { label: string; cls: string }> = {
  STORED_CLEAN: { label: 'Clean',   cls: 'bg-green-100 text-green-800'  },
  IN_USE:       { label: 'In use',  cls: 'bg-blue-100 text-blue-800'    },
  STORED_DIRTY: { label: 'Dirty',   cls: 'bg-amber-100 text-amber-800'  },
  AT_LAUNDRY:   { label: 'Laundry', cls: 'bg-purple-100 text-purple-800' },
}
const LINEN_STATES = ['STORED_CLEAN', 'IN_USE', 'STORED_DIRTY', 'AT_LAUNDRY'] as const

function relativeTime(date: string | Date) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// ── Alerts strip ───────────────────────────────────────────────────────────────

function AlertsStrip({ alerts }: { alerts: LogisticsAlert[] }) {
  if (alerts.length === 0) return null
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
        <span className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
        </span>
      </div>
      <ul className="space-y-1.5">
        {alerts.map((a, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
            <Badge variant="warning" className="mt-0.5 shrink-0 text-[10px]">
              {a.type === 'BELOW_PAR' ? 'Below PAR' : 'Restock'}
            </Badge>
            <span><strong>{a.name}</strong> — {a.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Individual linen pieces view ───────────────────────────────────────────────

function PiecesView({ listingId, linenSets, setLinenSets, readonly, busy, setBusy }: {
  listingId: string
  linenSets: LinenSet[]
  setLinenSets: React.Dispatch<React.SetStateAction<LinenSet[]>>
  readonly: boolean
  busy: string | null
  setBusy: (s: string | null) => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [newType, setNewType] = useState<'SHEETS' | 'TOWELS'>('SHEETS')

  async function setLinenState(id: string, state: string) {
    setBusy(id)
    const res = await fetch(`/api/linen-sets/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state }),
    })
    if (res.ok) {
      const j = await res.json()
      setLinenSets((prev) => prev.map((s) => s.id === id ? { ...s, ...j.data } : s))
    }
    setBusy(null)
  }

  async function addLinenSet() {
    setBusy('add-linen')
    const res = await fetch('/api/linen-sets', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId, type: newType, label: '' }),
    })
    if (res.ok) {
      const j = await res.json()
      setLinenSets((prev) => [...prev, j.data])
    }
    setBusy(null)
  }

  async function deleteLinenSet(id: string) {
    setBusy(id)
    const res = await fetch(`/api/linen-sets/${id}`, { method: 'DELETE' })
    if (res.ok) setLinenSets((prev) => prev.filter((s) => s.id !== id))
    setBusy(null)
  }

  async function bulkMove(state: string) {
    if (selected.size === 0) return
    setBusy('bulk')
    const res = await fetch('/api/linen-sets/bulk', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId, ids: Array.from(selected), state }),
    })
    if (res.ok) {
      setLinenSets((prev) => prev.map((s) => selected.has(s.id) ? { ...s, state } : s))
      setSelected(new Set())
    }
    setBusy(null)
  }

  return (
    <div>
      {!readonly && selected.size > 0 && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-xs text-muted-foreground">{selected.size} selected:</span>
          {LINEN_STATES.map((s) => (
            <button key={s} onClick={() => bulkMove(s)} disabled={busy === 'bulk'}
              className={cn('rounded-full px-2 py-0.5 text-xs font-medium', LINEN_STATE_CONFIG[s].cls)}>
              → {LINEN_STATE_CONFIG[s].label}
            </button>
          ))}
        </div>
      )}

      {[{ label: 'Sheets', type: 'SHEETS' }, { label: 'Towels', type: 'TOWELS' }].map(({ label, type }) => {
        const sets = linenSets.filter((s) => s.type === type)
        return (
          <div key={label} className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
            {sets.length === 0 ? (
              <p className="text-sm text-muted-foreground">None added yet.</p>
            ) : (
              <div className="space-y-2">
                {sets.map((s) => (
                  <div key={s.id}
                    className={cn('flex items-center gap-3 rounded-xl border p-3', selected.has(s.id) && 'border-primary/50 bg-primary/5')}>
                    {!readonly && (
                      <input type="checkbox" checked={selected.has(s.id)}
                        onChange={(e) => {
                          const next = new Set(selected)
                          if (e.target.checked) next.add(s.id); else next.delete(s.id)
                          setSelected(next)
                        }}
                        className="h-4 w-4 rounded border-input accent-primary" />
                    )}
                    <span className="text-sm flex-1 font-medium">{s.label}</span>
                    {!readonly ? (
                      <div className="flex gap-1 flex-wrap">
                        {LINEN_STATES.map((st) => (
                          <button key={st} onClick={() => setLinenState(s.id, st)} disabled={busy === s.id}
                            className={cn('rounded-full px-2.5 py-1 text-xs font-medium transition-opacity', LINEN_STATE_CONFIG[st].cls, s.state !== st && 'opacity-40')}>
                            {LINEN_STATE_CONFIG[st].label}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', LINEN_STATE_CONFIG[s.state]?.cls ?? 'bg-muted')}>
                        {LINEN_STATE_CONFIG[s.state]?.label ?? s.state}
                      </span>
                    )}
                    <div className="text-[10px] text-muted-foreground hidden sm:block">
                      {s.updatedBy?.name && `by ${s.updatedBy.name} · `}{relativeTime(s.updatedAt)}
                    </div>
                    {!readonly && (
                      <button onClick={() => deleteLinenSet(s.id)} disabled={busy === s.id}
                        className="text-muted-foreground hover:text-destructive p-1">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      {!readonly && (
        <div className="flex gap-2 mt-2">
          <select value={newType} onChange={(e) => setNewType(e.target.value as 'SHEETS' | 'TOWELS')}
            className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="SHEETS">Sheets</option>
            <option value="TOWELS">Towels</option>
          </select>
          <Button variant="outline" size="sm" onClick={addLinenSet} disabled={busy === 'add-linen'}>
            <Plus className="mr-1.5 h-4 w-4" /> Add set
          </Button>
        </div>
      )}
    </div>
  )
}

// ── LogisticsPanel ─────────────────────────────────────────────────────────────

export function LogisticsPanel({ listingId, initialData, readonly = false, prepSlotId }: LogisticsPanelProps) {
  const [linenSets, setLinenSets] = useState(initialData.linenSets)
  const [consumables, setConsumables] = useState<ConsumableLocal[]>(initialData.consumables)
  const [damageReports, setDamageReports] = useState(initialData.damageReports)
  const [bundles, setBundles] = useState<BundleEntry[]>(initialData.linenBundles ?? [])
  const alerts = initialData.alerts ?? []
  const [busy, setBusy] = useState<string | null>(null)
  const [newDamage, setNewDamage] = useState('')
  const [linenMode, setLinenMode] = useState<'bundles' | 'pieces'>('bundles')

  // Persist segmented-control selection per listing
  useEffect(() => {
    const saved = localStorage.getItem(`linen-mode-${listingId}`)
    if (saved === 'bundles' || saved === 'pieces') setLinenMode(saved)
  }, [listingId])

  function changeLinenMode(m: 'bundles' | 'pieces') {
    setLinenMode(m)
    localStorage.setItem(`linen-mode-${listingId}`, m)
  }

  const restockCount = consumables.filter((c) => c.needsRestock).length

  // ── Damage reports ──

  async function submitDamage() {
    if (!newDamage.trim()) return
    setBusy('damage')
    const res = await fetch(`/api/listings/${listingId}/damage-reports`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: newDamage.trim(), ...(prepSlotId ? { prepSlotId } : {}) }),
    })
    if (res.ok) {
      const j = await res.json()
      setDamageReports((prev) => [j.data, ...prev])
      setNewDamage('')
    }
    setBusy(null)
  }

  return (
    <div className="space-y-6">
      {/* Alerts strip */}
      <AlertsStrip alerts={alerts} />

      {/* Main tabs: Linen | Supplies */}
      <Tabs defaultValue="linen">
        <TabsList>
          <TabsTrigger value="linen">Linen</TabsTrigger>
          <TabsTrigger value="consumables" className="gap-1.5">
            Supplies
            {restockCount > 0 && (
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                {restockCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Linen tab ── */}
        <TabsContent value="linen">
          {/* Bundles / Pieces segmented control */}
          <div className="flex rounded-lg border divide-x overflow-hidden text-sm mb-4 w-fit">
            {(['bundles', 'pieces'] as const).map((m) => (
              <button key={m} onClick={() => changeLinenMode(m)}
                className={cn('px-4 py-1.5 capitalize transition-colors', linenMode === m ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted')}>
                {m === 'bundles' ? 'Bundles' : 'Pieces'}
              </button>
            ))}
          </div>

          {linenMode === 'bundles' ? (
            <BundlesView listingId={listingId} bundles={bundles} readonly={readonly} onBundlesChange={setBundles} />
          ) : (
            <PiecesView listingId={listingId} linenSets={linenSets} setLinenSets={setLinenSets}
              readonly={readonly} busy={busy} setBusy={setBusy} />
          )}
        </TabsContent>

        {/* ── Supplies tab ── */}
        <TabsContent value="consumables">
          <ConsumablesView listingId={listingId} consumables={consumables} readonly={readonly}
            onConsumablesChange={setConsumables} />
        </TabsContent>
      </Tabs>

      {/* Damage reports */}
      {(damageReports.length > 0 || !readonly) && (
        <section>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            Damage reports
          </h3>
          {damageReports.length > 0 && (
            <div className="space-y-2 mb-4">
              {damageReports.map((r) => (
                <div key={r.id} className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{r.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {r.reporter?.name ?? 'Unknown'} · {relativeTime(r.createdAt)}
                      </p>
                    </div>
                    {!readonly && r.status === 'OPEN' && (
                      <button
                        onClick={async () => {
                          const res = await fetch(`/api/damage-reports/${r.id}`, {
                            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ status: 'ACKNOWLEDGED' }),
                          })
                          if (res.ok) setDamageReports((prev) => prev.filter((x) => x.id !== r.id))
                        }}
                        className="text-xs text-muted-foreground underline hover:text-foreground shrink-0">
                        Acknowledge
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {!readonly && (
            <div className="flex gap-2">
              <input value={newDamage} onChange={(e) => setNewDamage(e.target.value)}
                placeholder="Describe the damage…"
                className="flex-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              <Button variant="destructive" size="sm" onClick={submitDamage} disabled={busy === 'damage' || !newDamage.trim()}>
                Report
              </Button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
