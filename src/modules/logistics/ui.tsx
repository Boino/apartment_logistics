'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Plus, Trash2, AlertTriangle } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

type LinenSet = {
  id: string; type: string; label: string; state: string
  updatedBy: { name: string } | null; updatedAt: string | Date
}
type Consumable = {
  id: string; name: string; unit: string | null; quantity: number | null; level: string | null
  updatedBy: { name: string } | null; updatedAt: string | Date
}
type DamageReport = {
  id: string; description: string; status: string; photoUrl: string | null; createdAt: string | Date
  reporter: { name: string } | null
}

export interface LogisticsPanelData {
  linenSets: LinenSet[]
  consumables: Consumable[]
  damageReports: DamageReport[]
}

interface LogisticsPanelProps {
  listingId: string
  initialData: LogisticsPanelData
  readonly?: boolean
  prepSlotId?: string
}

// ── State labels + colors ─────────────────────────────────────────────────────

const LINEN_STATE_CONFIG: Record<string, { label: string; cls: string }> = {
  STORED_CLEAN: { label: 'Clean', cls: 'bg-green-100 text-green-800' },
  IN_USE: { label: 'In use', cls: 'bg-blue-100 text-blue-800' },
  STORED_DIRTY: { label: 'Dirty', cls: 'bg-amber-100 text-amber-800' },
  AT_LAUNDRY: { label: 'Laundry', cls: 'bg-purple-100 text-purple-800' },
}
const LINEN_STATES = ['STORED_CLEAN', 'IN_USE', 'STORED_DIRTY', 'AT_LAUNDRY'] as const

const LEVEL_CONFIG: Record<string, { label: string; cls: string }> = {
  FULL: { label: 'Full', cls: 'bg-green-100 text-green-800' },
  OK: { label: 'OK', cls: 'bg-blue-100 text-blue-800' },
  LOW: { label: 'Low', cls: 'bg-amber-100 text-amber-800' },
  EMPTY: { label: 'Empty', cls: 'bg-red-100 text-red-800' },
}
const LEVELS = ['FULL', 'OK', 'LOW', 'EMPTY'] as const

function relativeTime(date: string | Date) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

// ── Component ─────────────────────────────────────────────────────────────────

export function LogisticsPanel({ listingId, initialData, readonly = false, prepSlotId }: LogisticsPanelProps) {
  const [linenSets, setLinenSets] = useState(initialData.linenSets)
  const [consumables, setConsumables] = useState(initialData.consumables)
  const [damageReports, setDamageReports] = useState(initialData.damageReports)
  const [busy, setBusy] = useState<string | null>(null)
  const [newLinenType, setNewLinenType] = useState<'SHEETS' | 'TOWELS'>('SHEETS')
  const [newDamage, setNewDamage] = useState('')
  const [selectedLinen, setSelectedLinen] = useState<Set<string>>(new Set())

  // ── Linen ──

  async function setLinenState(id: string, state: string) {
    setBusy(id)
    const res = await fetch(`/api/linen-sets/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state }),
    })
    if (res.ok) {
      const json = await res.json()
      setLinenSets((prev) => prev.map((s) => s.id === id ? { ...s, ...json.data } : s))
    }
    setBusy(null)
  }

  async function addLinenSet() {
    setBusy('add-linen')
    const res = await fetch('/api/linen-sets', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId, type: newLinenType, label: '' }),
    })
    if (res.ok) {
      const json = await res.json()
      setLinenSets((prev) => [...prev, json.data])
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
    if (selectedLinen.size === 0) return
    setBusy('bulk')
    const res = await fetch('/api/linen-sets/bulk', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId, ids: Array.from(selectedLinen), state }),
    })
    if (res.ok) {
      setLinenSets((prev) => prev.map((s) => selectedLinen.has(s.id) ? { ...s, state } : s))
      setSelectedLinen(new Set())
    }
    setBusy(null)
  }

  // ── Consumables ──

  async function adjustQuantity(id: string, delta: number, current: number) {
    const next = Math.max(0, current + delta)
    setBusy(id)
    const res = await fetch(`/api/consumables/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity: next }),
    })
    if (res.ok) {
      const json = await res.json()
      setConsumables((prev) => prev.map((c) => c.id === id ? { ...c, ...json.data } : c))
    }
    setBusy(null)
  }

  async function setLevel(id: string, level: string) {
    setBusy(id)
    const res = await fetch(`/api/consumables/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level }),
    })
    if (res.ok) {
      const json = await res.json()
      setConsumables((prev) => prev.map((c) => c.id === id ? { ...c, ...json.data } : c))
    }
    setBusy(null)
  }

  // ── Damage reports ──

  async function submitDamage() {
    if (!newDamage.trim()) return
    setBusy('damage')
    const res = await fetch(`/api/listings/${listingId}/damage-reports`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: newDamage.trim(), ...(prepSlotId ? { prepSlotId } : {}) }),
    })
    if (res.ok) {
      const json = await res.json()
      setDamageReports((prev) => [json.data, ...prev])
      setNewDamage('')
    }
    setBusy(null)
  }

  const sheetSets = linenSets.filter((s) => s.type === 'SHEETS')
  const towelSets = linenSets.filter((s) => s.type === 'TOWELS')

  return (
    <div className="space-y-8">
      {/* ── Linen ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Linen</h3>
          {!readonly && selectedLinen.size > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground self-center">{selectedLinen.size} selected:</span>
              {LINEN_STATES.map((s) => (
                <button key={s} onClick={() => bulkMove(s)} disabled={busy === 'bulk'}
                  className={cn('rounded-full px-2 py-0.5 text-xs font-medium', LINEN_STATE_CONFIG[s].cls)}>
                  → {LINEN_STATE_CONFIG[s].label}
                </button>
              ))}
            </div>
          )}
        </div>

        {[{ label: 'Sheets', sets: sheetSets, type: 'SHEETS' }, { label: 'Towels', sets: towelSets, type: 'TOWELS' }].map(({ label, sets }) => (
          <div key={label} className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{label}</p>
            {sets.length === 0 ? (
              <p className="text-sm text-muted-foreground">None added yet.</p>
            ) : (
              <div className="space-y-2">
                {sets.map((s) => (
                  <div key={s.id} className={cn('flex items-center gap-3 rounded-xl border p-3', selectedLinen.has(s.id) && 'border-primary/50 bg-primary/5')}>
                    {!readonly && (
                      <input type="checkbox" checked={selectedLinen.has(s.id)}
                        onChange={(e) => {
                          const next = new Set(selectedLinen)
                          if (e.target.checked) next.add(s.id)
                          else next.delete(s.id)
                          setSelectedLinen(next)
                        }}
                        className="h-4 w-4 rounded border-input accent-primary"
                      />
                    )}
                    <span className="text-sm flex-1 font-medium">{s.label}</span>
                    {!readonly ? (
                      <div className="flex gap-1 flex-wrap">
                        {LINEN_STATES.map((st) => (
                          <button key={st} onClick={() => setLinenState(s.id, st)}
                            disabled={busy === s.id}
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
        ))}

        {!readonly && (
          <div className="flex gap-2 mt-2">
            <select value={newLinenType} onChange={(e) => setNewLinenType(e.target.value as 'SHEETS' | 'TOWELS')}
              className="rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="SHEETS">Sheets</option>
              <option value="TOWELS">Towels</option>
            </select>
            <Button variant="outline" size="sm" onClick={addLinenSet} disabled={busy === 'add-linen'}>
              <Plus className="mr-1.5 h-4 w-4" />Add set
            </Button>
          </div>
        )}
      </section>

      {/* ── Consumables ── */}
      <section>
        <h3 className="font-semibold mb-3">Supplies</h3>
        {consumables.length === 0 ? (
          <p className="text-sm text-muted-foreground">No supplies tracked yet.</p>
        ) : (
          <div className="space-y-2">
            {consumables.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {c.updatedBy?.name && `by ${c.updatedBy.name} · `}{relativeTime(c.updatedAt)}
                  </p>
                </div>
                {c.quantity !== null ? (
                  readonly ? (
                    <span className="text-sm font-semibold">{c.quantity} {c.unit ?? ''}</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button onClick={() => adjustQuantity(c.id, -1, c.quantity!)} disabled={busy === c.id}
                        className="flex h-8 w-8 items-center justify-center rounded-full border text-sm hover:bg-muted">−</button>
                      <span className="w-10 text-center text-sm font-semibold">{c.quantity}</span>
                      <button onClick={() => adjustQuantity(c.id, +1, c.quantity!)} disabled={busy === c.id}
                        className="flex h-8 w-8 items-center justify-center rounded-full border text-sm hover:bg-muted">+</button>
                      {c.unit && <span className="text-xs text-muted-foreground">{c.unit}</span>}
                    </div>
                  )
                ) : (
                  <div className="flex gap-1 flex-wrap">
                    {LEVELS.map((lvl) => (
                      <button key={lvl} onClick={() => !readonly && setLevel(c.id, lvl)}
                        disabled={readonly || busy === c.id}
                        className={cn('rounded-full px-2.5 py-1 text-xs font-medium', LEVEL_CONFIG[lvl].cls, c.level !== lvl && 'opacity-40', readonly && 'cursor-default')}>
                        {LEVEL_CONFIG[lvl].label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Damage reports ── */}
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
                        className="text-xs text-muted-foreground underline hover:text-foreground shrink-0"
                      >
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
