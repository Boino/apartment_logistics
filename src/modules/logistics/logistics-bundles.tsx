'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Modal, ModalContent, ModalHeader, ModalTitle } from '@/components/ui/modal'
import { Plus, Trash2, ChevronDown, ChevronUp, Layers } from 'lucide-react'

// ── Local types (structurally match LogisticsPanelData.linenBundles) ──────────

export type BundleInstance = {
  id: string; templateId: string; listingId: string; label: string; state: string
  updatedBy: { name: string } | null; updatedAt: string | Date
}

export type BundleTemplate = {
  id: string; name: string; description?: string | null; parTarget: number
  components: Array<{ itemType: string; quantity: number }>
  createdAt: string | Date; updatedAt: string | Date
}

export type BundleEntry = {
  template: BundleTemplate
  instances: BundleInstance[]
  counts: { STORED_CLEAN: number; IN_USE: number; STORED_DIRTY: number; AT_LAUNDRY: number; total: number }
  parTarget: number
  belowPar: boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STATE_CFG: Record<string, { label: string; cls: string }> = {
  STORED_CLEAN: { label: 'Clean',   cls: 'bg-green-100 text-green-800' },
  IN_USE:       { label: 'In use',  cls: 'bg-blue-100 text-blue-800' },
  STORED_DIRTY: { label: 'Dirty',   cls: 'bg-amber-100 text-amber-800' },
  AT_LAUNDRY:   { label: 'Laundry', cls: 'bg-purple-100 text-purple-800' },
}
const STATES = ['STORED_CLEAN', 'IN_USE', 'STORED_DIRTY', 'AT_LAUNDRY'] as const

const PRESETS = [
  { itemType: 'Fitted sheet', quantity: 1 },
  { itemType: 'Flat sheet',   quantity: 1 },
  { itemType: 'Pillowcase',   quantity: 2 },
  { itemType: 'Duvet cover',  quantity: 1 },
  { itemType: 'Bath towel',   quantity: 2 },
  { itemType: 'Hand towel',   quantity: 2 },
  { itemType: 'Washcloth',    quantity: 2 },
]

function relTime(d: string | Date) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

function rebuildEntry(entry: BundleEntry, instances: BundleInstance[]): BundleEntry {
  const c = {
    STORED_CLEAN: instances.filter((i) => i.state === 'STORED_CLEAN').length,
    IN_USE:       instances.filter((i) => i.state === 'IN_USE').length,
    STORED_DIRTY: instances.filter((i) => i.state === 'STORED_DIRTY').length,
    AT_LAUNDRY:   instances.filter((i) => i.state === 'AT_LAUNDRY').length,
    total:        instances.length,
  }
  return { ...entry, instances, counts: c, belowPar: c.STORED_CLEAN < entry.template.parTarget }
}

// ── Bundle wizard ─────────────────────────────────────────────────────────────

type PresetItem = { itemType: string; quantity: number; enabled: boolean }

function BundleWizard({ listingId, onCreated, onClose }: {
  listingId: string
  onCreated: (entry: BundleEntry) => void
  onClose: () => void
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [name, setName] = useState('')
  const [parTarget, setParTarget] = useState(3)
  const [presets, setPresets] = useState<PresetItem[]>(PRESETS.map((p) => ({ ...p, enabled: true })))
  const [customItems, setCustomItems] = useState<Array<{ itemType: string; quantity: number }>>([])
  const [customInput, setCustomInput] = useState('')
  const [instanceCount, setInstanceCount] = useState(3)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function goStep2() {
    if (!name.trim()) { setError('Name is required'); return }
    setError(null); setStep(2)
  }
  function goStep3() {
    const all = [...presets.filter((p) => p.enabled), ...customItems.filter((c) => c.itemType.trim())]
    if (all.length === 0) { setError('Add at least one component'); return }
    setError(null); setInstanceCount(parTarget); setStep(3)
  }

  function addCustom() {
    if (!customInput.trim()) return
    setCustomItems((prev) => [...prev, { itemType: customInput.trim(), quantity: 1 }])
    setCustomInput('')
  }

  async function submit() {
    setSubmitting(true); setError(null)
    const components = [
      ...presets.filter((p) => p.enabled).map(({ itemType, quantity }) => ({ itemType, quantity })),
      ...customItems.filter((c) => c.itemType.trim()),
    ]
    try {
      const tmplRes = await fetch(`/api/listings/${listingId}/linen-bundles`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), parTarget, components }),
      })
      if (!tmplRes.ok) {
        const j = await tmplRes.json()
        setError(j.error?.message ?? 'Failed to create template'); setSubmitting(false); return
      }
      const { data: template } = await tmplRes.json()
      const labels = Array.from({ length: instanceCount }, (_, i) => `${name.trim()} #${i + 1}`)
      const results = await Promise.all(
        labels.map((label) =>
          fetch(`/api/linen-bundles/${template.id}/instances`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ label }),
          }).then((r) => r.json()),
        ),
      )
      const instances = results.filter((r) => r.data).map((r) => r.data as BundleInstance)
      const cleanCount = instances.length
      onCreated({
        template: { ...template, components },
        instances,
        counts: { STORED_CLEAN: cleanCount, IN_USE: 0, STORED_DIRTY: 0, AT_LAUNDRY: 0, total: cleanCount },
        parTarget,
        belowPar: cleanCount < parTarget,
      })
      onClose()
    } catch {
      setError('Network error — please try again')
    }
    setSubmitting(false)
  }

  const stepLabels: Record<1 | 2 | 3, string> = { 1: 'Name & target', 2: 'Components', 3: 'Instances' }

  return (
    <div className="space-y-4">
      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {([1, 2, 3] as const).map((s) => (
          <div key={s} className={cn(
            'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold shrink-0',
            step === s ? 'bg-primary text-primary-foreground' : step > s ? 'bg-primary/30 text-primary' : 'bg-muted text-muted-foreground',
          )}>{s}</div>
        ))}
        <span className="text-sm text-muted-foreground ml-1">{stepLabels[step]}</span>
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Bundle name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Queen bed kit"
              autoFocus onKeyDown={(e) => { if (e.key === 'Enter') goStep2() }}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="text-sm font-medium">PAR target</label>
            <p className="text-xs text-muted-foreground mb-1">
              Minimum clean sets to keep in rotation. PAR 3 = one in use + one at laundry + one clean standby.
            </p>
            <input type="number" min={1} max={20} value={parTarget}
              onChange={(e) => setParTarget(Math.max(1, Math.min(20, Number(e.target.value))))}
              className="w-24 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={goStep2}>Next →</Button>
          </div>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Select what goes into one complete set.</p>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {presets.map((p, i) => (
              <div key={p.itemType} className="flex items-center gap-3">
                <input type="checkbox" checked={p.enabled}
                  onChange={(e) => {
                    const next = [...presets]; next[i] = { ...next[i], enabled: e.target.checked }; setPresets(next)
                  }}
                  className="h-4 w-4 rounded border-input accent-primary shrink-0" />
                <span className="text-sm flex-1">{p.itemType}</span>
                <input type="number" min={1} max={20} value={p.quantity} disabled={!p.enabled}
                  onChange={(e) => {
                    const next = [...presets]; next[i] = { ...next[i], quantity: Math.max(1, Number(e.target.value)) }; setPresets(next)
                  }}
                  className="w-14 rounded-md border bg-background px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-40" />
                <span className="text-xs text-muted-foreground w-6">ea.</span>
              </div>
            ))}
            {customItems.map((item, i) => (
              <div key={`c${i}`} className="flex items-center gap-3 border-t pt-2 mt-2">
                <input type="checkbox" checked readOnly className="h-4 w-4 rounded border-input accent-primary opacity-60 shrink-0" />
                <span className="text-sm flex-1">{item.itemType}</span>
                <input type="number" min={1} max={20} value={item.quantity}
                  onChange={(e) => {
                    const next = [...customItems]; next[i] = { ...next[i], quantity: Math.max(1, Number(e.target.value)) }; setCustomItems(next)
                  }}
                  className="w-14 rounded-md border bg-background px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-ring" />
                <span className="text-xs text-muted-foreground w-6">ea.</span>
                <button onClick={() => setCustomItems((prev) => prev.filter((_, j) => j !== i))}
                  className="text-muted-foreground hover:text-destructive shrink-0">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={customInput} onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addCustom() }}
              placeholder="Custom item…"
              className="flex-1 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            <Button variant="outline" size="sm" onClick={addCustom} disabled={!customInput.trim()}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
            <Button onClick={goStep3}>Next →</Button>
          </div>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">How many sets to create now?</label>
            <p className="text-xs text-muted-foreground mb-1">
              Auto-labelled &ldquo;{name} #1&rdquo;, &ldquo;{name} #2&rdquo;&hellip; You can add more later.
            </p>
            <input type="number" min={0} max={parTarget * 3} value={instanceCount}
              onChange={(e) => setInstanceCount(Math.max(0, Number(e.target.value)))}
              className="w-24 rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          {instanceCount > 0 && (
            <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground leading-relaxed">
              {Array.from({ length: Math.min(instanceCount, 4) }, (_, i) => `${name} #${i + 1}`).join(' · ')}
              {instanceCount > 4 && ` · … +${instanceCount - 4} more`}
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>← Back</Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting ? 'Creating…' : instanceCount > 0 ? `Create template + ${instanceCount} sets` : 'Create template'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Single instance row ────────────────────────────────────────────────────────

function InstanceRow({ instance, readonly, busy, onState, onDelete }: {
  instance: BundleInstance; readonly: boolean; busy: string | null
  onState: (id: string, state: string) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-background p-2.5 flex-wrap sm:flex-nowrap">
      <span className="text-sm font-medium flex-1 min-w-0 truncate">{instance.label}</span>
      {readonly ? (
        <span className={cn('rounded-full px-2.5 py-1 text-xs font-medium shrink-0', STATE_CFG[instance.state]?.cls ?? 'bg-muted')}>
          {STATE_CFG[instance.state]?.label ?? instance.state}
        </span>
      ) : (
        <div className="flex gap-1 flex-wrap">
          {STATES.map((st) => (
            <button key={st} onClick={() => onState(instance.id, st)} disabled={busy === instance.id}
              className={cn('rounded-full px-2.5 py-1 text-xs font-medium transition-opacity', STATE_CFG[st].cls, instance.state !== st && 'opacity-40')}>
              {STATE_CFG[st].label}
            </button>
          ))}
        </div>
      )}
      <span className="text-[10px] text-muted-foreground hidden sm:block shrink-0">
        {instance.updatedBy?.name ? `${instance.updatedBy.name} · ` : ''}{relTime(instance.updatedAt)}
      </span>
      {!readonly && (
        <button onClick={() => onDelete(instance.id)} disabled={busy === instance.id}
          className="text-muted-foreground hover:text-destructive p-1 shrink-0">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}

// ── Expandable template row ────────────────────────────────────────────────────

function BundleTemplateRow({ entry, readonly, listingId, onUpdate }: {
  entry: BundleEntry; readonly: boolean; listingId: string
  onUpdate: (updated: BundleEntry) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [addingInst, setAddingInst] = useState(false)
  const [newLabel, setNewLabel] = useState('')

  async function changeState(instanceId: string, state: string) {
    setBusy(instanceId)
    const res = await fetch(`/api/linen-bundle-instances/${instanceId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state }),
    })
    if (res.ok) {
      const { data } = await res.json()
      onUpdate(rebuildEntry(entry, entry.instances.map((i) => i.id === instanceId ? { ...i, ...data } : i)))
    }
    setBusy(null)
  }

  async function deleteInst(instanceId: string) {
    setBusy(instanceId)
    const res = await fetch(`/api/linen-bundle-instances/${instanceId}`, { method: 'DELETE' })
    if (res.ok) onUpdate(rebuildEntry(entry, entry.instances.filter((i) => i.id !== instanceId)))
    setBusy(null)
  }

  async function bulkMove(state: string) {
    if (selected.size === 0) return
    setBusy('bulk')
    const res = await fetch('/api/linen-bundle-instances/bulk', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listingId, ids: Array.from(selected), state }),
    })
    if (res.ok) {
      onUpdate(rebuildEntry(entry, entry.instances.map((i) => selected.has(i.id) ? { ...i, state } : i)))
      setSelected(new Set())
    }
    setBusy(null)
  }

  async function addInst() {
    const label = newLabel.trim() || `${entry.template.name} #${entry.instances.length + 1}`
    setBusy('add')
    const res = await fetch(`/api/linen-bundles/${entry.template.id}/instances`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    })
    if (res.ok) {
      const { data } = await res.json()
      onUpdate(rebuildEntry(entry, [...entry.instances, data as BundleInstance]))
      setNewLabel(''); setAddingInst(false)
    }
    setBusy(null)
  }

  const { counts, template, belowPar } = entry

  return (
    <div id={`bundle-tmpl-${template.id}`}
      className={cn('rounded-xl border bg-card overflow-hidden transition-colors', belowPar && 'border-amber-300')}>
      {/* Header row */}
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-muted/30 transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold">{template.name}</span>
            <Badge variant="outline" className="text-xs">PAR {template.parTarget}</Badge>
            {belowPar && <Badge variant="warning">Below PAR</Badge>}
          </div>
          {template.components.length > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
              {template.components.map((c) => `${c.quantity}× ${c.itemType}`).join(' · ')}
            </p>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap justify-end shrink-0">
          {STATES.map((st) => counts[st] > 0 && (
            <span key={st} className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATE_CFG[st].cls)}>
              {counts[st]} {STATE_CFG[st].label.toLowerCase()}
            </span>
          ))}
          {counts.total === 0 && <span className="text-xs text-muted-foreground">no sets</span>}
        </div>
        {expanded
          ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
          : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />}
      </button>

      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          {/* Bulk toolbar */}
          {!readonly && selected.size > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground">{selected.size} selected:</span>
              {STATES.map((st) => (
                <button key={st} onClick={() => bulkMove(st)} disabled={busy === 'bulk'}
                  className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATE_CFG[st].cls)}>
                  → {STATE_CFG[st].label}
                </button>
              ))}
            </div>
          )}

          {/* Instance list */}
          {entry.instances.length === 0
            ? <p className="text-sm text-muted-foreground py-2">No sets yet. Add one below.</p>
            : (
              <div className="space-y-2">
                {entry.instances.map((inst) => (
                  <div key={inst.id} className="flex items-center gap-2">
                    {!readonly && (
                      <input type="checkbox" checked={selected.has(inst.id)}
                        onChange={(e) => {
                          const next = new Set(selected)
                          if (e.target.checked) next.add(inst.id); else next.delete(inst.id)
                          setSelected(next)
                        }}
                        className="h-4 w-4 rounded border-input accent-primary shrink-0" />
                    )}
                    <div className="flex-1">
                      <InstanceRow instance={inst} readonly={readonly} busy={busy}
                        onState={changeState} onDelete={deleteInst} />
                    </div>
                  </div>
                ))}
              </div>
            )}

          {/* Add instance */}
          {!readonly && (
            addingInst ? (
              <div className="flex gap-2">
                <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
                  placeholder={`${template.name} #${entry.instances.length + 1}`}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') addInst(); if (e.key === 'Escape') setAddingInst(false) }}
                  className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
                <Button size="sm" onClick={addInst} disabled={busy === 'add'}>Add</Button>
                <Button size="sm" variant="outline" onClick={() => setAddingInst(false)}>Cancel</Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setAddingInst(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add instance
              </Button>
            )
          )}
        </div>
      )}
    </div>
  )
}

// ── Main BundlesView export ────────────────────────────────────────────────────

export function BundlesView({ listingId, bundles, readonly, onBundlesChange }: {
  listingId: string
  bundles: BundleEntry[]
  readonly: boolean
  onBundlesChange: (updated: BundleEntry[]) => void
}) {
  const [wizardOpen, setWizardOpen] = useState(false)

  return (
    <div className="space-y-3">
      {bundles.length === 0 ? (
        <div className="flex flex-col items-center py-12 text-center gap-3">
          <div className="rounded-full bg-primary/10 p-4">
            <Layers className="h-8 w-8 text-primary" />
          </div>
          <h3 className="font-semibold text-lg">Track linen as complete kits</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Define a bundle template (e.g. &ldquo;Queen bed kit&rdquo;) and track each physical
            set through washing cycles. Industry standard: PAR 3 — one in use, one at laundry,
            one clean standby.
          </p>
          {!readonly && (
            <Button onClick={() => setWizardOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" /> Create your first bundle
            </Button>
          )}
        </div>
      ) : (
        <>
          {!readonly && (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setWizardOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1.5" /> New bundle template
              </Button>
            </div>
          )}
          <div className="space-y-3">
            {bundles.map((entry) => (
              <BundleTemplateRow key={entry.template.id} entry={entry} readonly={readonly}
                listingId={listingId}
                onUpdate={(updated) => onBundlesChange(bundles.map((b) => b.template.id === updated.template.id ? updated : b))} />
            ))}
          </div>
        </>
      )}

      <Modal open={wizardOpen} onOpenChange={setWizardOpen}>
        <ModalContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <ModalHeader>
            <ModalTitle>Create bundle template</ModalTitle>
          </ModalHeader>
          <BundleWizard listingId={listingId}
            onCreated={(e) => { onBundlesChange([...bundles, e]) }}
            onClose={() => setWizardOpen(false)} />
        </ModalContent>
      </Modal>
    </div>
  )
}
