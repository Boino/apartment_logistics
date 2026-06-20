'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal, ModalContent, ModalHeader, ModalTitle } from '@/components/ui/modal'
import { Plus, AlertTriangle, Minus } from 'lucide-react'

// ── Local types ────────────────────────────────────────────────────────────────

export type ConsumableLocal = {
  id: string
  listingId: string
  name: string
  unit: string
  mode: 'LEVEL' | 'QUANTITY'
  level: string | null
  quantity: number | null
  parTarget: number | null
  reorderThreshold: number | null
  needsRestock: boolean
  updatedAt: string | Date
}

const LEVEL_CFG: Record<string, { label: string; cls: string; bg: string }> = {
  FULL:   { label: 'Full',   cls: 'bg-green-100 text-green-800', bg: 'bg-green-500'  },
  MEDIUM: { label: 'Medium', cls: 'bg-blue-100 text-blue-800',   bg: 'bg-blue-500'   },
  LOW:    { label: 'Low',    cls: 'bg-amber-100 text-amber-800', bg: 'bg-amber-500'  },
  EMPTY:  { label: 'Empty',  cls: 'bg-red-100 text-red-800',     bg: 'bg-red-500'    },
}
const LEVELS = ['FULL', 'MEDIUM', 'LOW', 'EMPTY'] as const

// ── Inline editable number cell ────────────────────────────────────────────────

function EditableNum({ value, onSave, placeholder = '—' }: {
  value: number | null
  onSave: (v: number | null) => void
  placeholder?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  if (editing) {
    return (
      <input autoFocus type="number" min={0} value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => { onSave(draft === '' ? null : Math.max(0, Number(draft))); setEditing(false) }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') { setEditing(false) }
        }}
        className="w-16 rounded border bg-background px-2 py-0.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-ring" />
    )
  }
  return (
    <button onClick={() => { setDraft(value !== null ? String(value) : ''); setEditing(true) }}
      className="w-16 rounded border border-transparent hover:border-input px-2 py-0.5 text-sm text-center text-muted-foreground">
      {value !== null ? value : <span className="text-xs opacity-50">{placeholder}</span>}
    </button>
  )
}

// ── Create consumable modal ────────────────────────────────────────────────────

function CreateConsumableModal({ listingId, onCreated, onClose }: {
  listingId: string
  onCreated: (c: ConsumableLocal) => void
  onClose: () => void
}) {
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('')
  const [mode, setMode] = useState<'LEVEL' | 'QUANTITY'>('LEVEL')
  const [parTarget, setParTarget] = useState('')
  const [reorderThreshold, setReorderThreshold] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!name.trim()) { setError('Name is required'); return }
    setSubmitting(true); setError(null)
    try {
      const res = await fetch(`/api/listings/${listingId}/consumables`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(), unit: unit.trim() || 'units', mode,
          parTarget: parTarget === '' ? null : Number(parTarget),
          reorderThreshold: mode === 'QUANTITY' && reorderThreshold !== '' ? Number(reorderThreshold) : null,
        }),
      })
      if (!res.ok) {
        const j = await res.json(); setError(j.error?.message ?? 'Failed'); setSubmitting(false); return
      }
      const { data } = await res.json()
      onCreated(data as ConsumableLocal); onClose()
    } catch { setError('Network error') }
    setSubmitting(false)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-sm font-medium">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Toilet paper"
            autoFocus onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label className="text-sm font-medium">Unit</label>
          <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="rolls"
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div>
          <label className="text-sm font-medium">Tracking mode</label>
          <select value={mode} onChange={(e) => setMode(e.target.value as 'LEVEL' | 'QUANTITY')}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="LEVEL">Level (Full/Medium/Low/Empty)</option>
            <option value="QUANTITY">Quantity (count)</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium">
            PAR target <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <input type="number" min={0} value={parTarget} onChange={(e) => setParTarget(e.target.value)}
            placeholder="e.g. 24"
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
        </div>
        {mode === 'QUANTITY' && (
          <div>
            <label className="text-sm font-medium">
              Reorder at <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <input type="number" min={0} value={reorderThreshold} onChange={(e) => setReorderThreshold(e.target.value)}
              placeholder="e.g. 4"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            <p className="text-xs text-muted-foreground mt-0.5">Alert fires when quantity ≤ this value</p>
          </div>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={submitting}>{submitting ? 'Creating…' : 'Add consumable'}</Button>
      </div>
    </div>
  )
}

// ── ConsumablesView (controlled) ───────────────────────────────────────────────

type Filter = 'all' | 'restock'

export function ConsumablesView({ listingId, consumables, readonly, onConsumablesChange }: {
  listingId: string
  consumables: ConsumableLocal[]
  readonly: boolean
  onConsumablesChange?: (items: ConsumableLocal[]) => void
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  function update(next: ConsumableLocal[]) {
    onConsumablesChange?.(next)
  }

  const restockCount = consumables.filter((c) => c.needsRestock).length
  const visible = filter === 'restock' ? consumables.filter((c) => c.needsRestock) : consumables

  async function patch(id: string, body: Record<string, unknown>) {
    setBusyId(id)
    const res = await fetch(`/api/consumables/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const { data } = await res.json()
      update(consumables.map((c) => c.id === id ? { ...c, ...(data as Partial<ConsumableLocal>) } : c))
    }
    setBusyId(null)
  }

  function setLevel(id: string, level: string) { patch(id, { level }) }
  function stepQuantity(id: string, delta: number, current: number | null) {
    patch(id, { quantity: Math.max(0, (current ?? 0) + delta) })
  }
  function setThreshold(id: string, field: 'reorderThreshold' | 'parTarget', value: number | null) {
    patch(id, { [field]: value })
  }

  function handleCreated(c: ConsumableLocal) {
    update([...consumables, c])
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex rounded-lg border divide-x overflow-hidden text-sm">
          {(['all', 'restock'] as Filter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('px-3 py-1.5 transition-colors', filter === f ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted')}>
              {f === 'all' ? `All (${consumables.length})` : `Needs restock${restockCount > 0 ? ` (${restockCount})` : ''}`}
            </button>
          ))}
        </div>
        {!readonly && (
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add consumable
          </Button>
        )}
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground text-sm">
          {filter === 'restock' ? 'Nothing needs restocking right now.' : 'No consumables yet.'}
        </div>
      ) : (
        <>
          {/* Column headers — desktop only */}
          <div className="hidden md:grid md:grid-cols-[1fr_auto_auto_auto] gap-x-4 px-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            <span>Item</span>
            <span className="text-right w-32">Status</span>
            <span className="text-center w-20">PAR target</span>
            <span className="text-center w-20">Reorder at</span>
          </div>
          <div className="space-y-2">
            {visible.map((c) => (
              <div key={c.id}
                className={cn('rounded-xl border bg-card p-3 transition-colors', c.needsRestock && 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/20')}>
                <div className="md:grid md:grid-cols-[1fr_auto_auto_auto] md:gap-x-4 md:items-center space-y-2 md:space-y-0">

                  {/* Name */}
                  <div className="flex items-center gap-2 min-w-0">
                    {c.needsRestock && <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />}
                    <span className="font-medium truncate">{c.name}</span>
                    {c.unit && <span className="text-xs text-muted-foreground shrink-0">({c.unit})</span>}
                    {c.needsRestock && <Badge variant="warning" className="hidden sm:inline-flex shrink-0">Restock</Badge>}
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-2 w-32 justify-end">
                    {c.mode === 'LEVEL' ? (
                      readonly ? (
                        <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium', LEVEL_CFG[c.level ?? 'FULL']?.cls)}>
                          {LEVEL_CFG[c.level ?? 'FULL']?.label}
                        </span>
                      ) : (
                        <div className="flex gap-0.5">
                          {LEVELS.map((lvl) => (
                            <button key={lvl} onClick={() => setLevel(c.id, lvl)} disabled={busyId === c.id}
                              title={LEVEL_CFG[lvl].label}
                              className={cn('h-6 w-6 rounded-sm transition-opacity', LEVEL_CFG[lvl].bg, c.level !== lvl && 'opacity-20')} />
                          ))}
                        </div>
                      )
                    ) : (
                      <div className="flex items-center gap-1">
                        {!readonly && (
                          <button onClick={() => stepQuantity(c.id, -1, c.quantity)} disabled={busyId === c.id || (c.quantity ?? 0) <= 0}
                            className="rounded-full border p-0.5 hover:bg-muted disabled:opacity-40">
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <span className="text-sm font-semibold w-8 text-center">{c.quantity ?? '—'}</span>
                        {!readonly && (
                          <button onClick={() => stepQuantity(c.id, +1, c.quantity)} disabled={busyId === c.id}
                            className="rounded-full border p-0.5 hover:bg-muted">
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* PAR target */}
                  <div className="flex items-center justify-center w-20">
                    {readonly ? (
                      <span className="text-sm text-muted-foreground">{c.parTarget ?? '—'}</span>
                    ) : (
                      <EditableNum value={c.parTarget} onSave={(v) => setThreshold(c.id, 'parTarget', v)} placeholder="set" />
                    )}
                  </div>

                  {/* Reorder threshold */}
                  <div className="flex items-center justify-center w-20">
                    {readonly || c.mode === 'LEVEL' ? (
                      <span className="text-xs text-muted-foreground">{c.mode === 'LEVEL' ? 'n/a' : (c.reorderThreshold ?? '—')}</span>
                    ) : (
                      <EditableNum value={c.reorderThreshold} onSave={(v) => setThreshold(c.id, 'reorderThreshold', v)} placeholder="set" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Create modal */}
      <Modal open={createOpen} onOpenChange={setCreateOpen}>
        <ModalContent className="max-w-md">
          <ModalHeader><ModalTitle>Add consumable</ModalTitle></ModalHeader>
          <CreateConsumableModal listingId={listingId} onCreated={handleCreated} onClose={() => setCreateOpen(false)} />
        </ModalContent>
      </Modal>
    </div>
  )
}
