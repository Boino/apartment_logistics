'use client'

import { useState, useEffect, useRef } from 'react'
import { format, parseISO } from 'date-fns'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type Message = {
  id: string
  body: string
  createdAt: string
  senderId: string | null
  sender: { id: string; name: string } | null
}

type InquiryDetails = {
  id: string
  checkinDate: string
  checkoutDate: string
  numGuests: number
  status: string
  comments: string | null
  guest: { id: string; name: string; email: string }
  listing: {
    id: string; title: string; currency: string
    hostId: string
    checkInTime: string; checkOutTime: string
    photos: { url: string }[]
  }
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open', ANSWERED: 'Answered', CONFIRMED: 'Confirmed',
  DECLINED: 'Declined', CLOSED: 'Closed',
}
const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  OPEN: 'default', ANSWERED: 'secondary', CONFIRMED: 'default',
  DECLINED: 'destructive', CLOSED: 'outline',
}

interface ThreadViewProps {
  threadId: string
  inquiry: InquiryDetails
  initialMessages: Message[]
  currentUserId: string
  isHost: boolean
}

export function ThreadView({ threadId, inquiry, initialMessages, currentUserId, isHost }: ThreadViewProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState(inquiry.status)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Poll for new messages every 10s
  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/threads/${threadId}/messages`)
      if (res.ok) {
        const json = await res.json()
        setMessages(json.data)
      }
    }, 10_000)
    return () => clearInterval(interval)
  }, [threadId])

  async function send() {
    if (!body.trim()) return
    setSending(true); setError(null)
    try {
      const res = await fetch(`/api/threads/${threadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: body.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error?.message ?? 'Failed to send'); return }
      setMessages((prev) => [...prev, json.data])
      setBody('')
      textareaRef.current?.focus()
      // auto-set status to ANSWERED if host sent first reply
      if (isHost && status === 'OPEN') setStatus('ANSWERED')
    } finally {
      setSending(false)
    }
  }

  async function changeStatus(newStatus: string) {
    setUpdatingStatus(true)
    const res = await fetch(`/api/inquiries/${inquiry.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) setStatus(newStatus)
    setUpdatingStatus(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send()
  }

  const checkin = format(parseISO(String(inquiry.checkinDate).slice(0, 10)), 'dd MMM yyyy')
  const checkout = format(parseISO(String(inquiry.checkoutDate).slice(0, 10)), 'dd MMM yyyy')

  return (
    <div className="flex flex-col h-full">
      {/* ── Inquiry summary ── */}
      <div className="rounded-lg border bg-muted/30 p-4 mb-4 space-y-2">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div>
            <p className="font-semibold">{inquiry.listing.title}</p>
            <p className="text-sm text-muted-foreground">
              {checkin} → {checkout} · {inquiry.numGuests} guest{inquiry.numGuests !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Check-in {inquiry.listing.checkInTime} · Check-out {inquiry.listing.checkOutTime}
            </p>
          </div>
          <Badge variant={STATUS_VARIANTS[status] ?? 'outline'}>{STATUS_LABELS[status] ?? status}</Badge>
        </div>

        {/* Host-only status controls */}
        {isHost && (
          <div className="flex flex-wrap gap-2 pt-1">
            {['ANSWERED', 'CONFIRMED', 'DECLINED', 'CLOSED'].filter((s) => s !== status).map((s) => (
              <Button
                key={s}
                variant="outline"
                size="sm"
                disabled={updatingStatus}
                onClick={() => changeStatus(s)}
                className={cn(s === 'DECLINED' && 'text-destructive hover:text-destructive')}
              >
                Mark {STATUS_LABELS[s]}
              </Button>
            ))}
            {status === 'CONFIRMED' && (
              <Button size="sm" asChild>
                <a href={`/host/stays/new?inquiryId=${inquiry.id}`}>Convert to stay →</a>
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4 min-h-0 max-h-[50vh]">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">No messages yet.</p>
        )}
        {messages.map((msg) => {
          const mine = msg.senderId === currentUserId
          return (
            <div key={msg.id} className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm',
                  mine
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-muted rounded-bl-sm',
                )}
              >
                {msg.body}
              </div>
              <span className="mt-0.5 text-[10px] text-muted-foreground">
                {msg.sender?.name ?? 'System'} ·{' '}
                {format(new Date(msg.createdAt), 'dd MMM, HH:mm')}
              </span>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* ── Reply box ── */}
      {status !== 'CLOSED' && status !== 'DECLINED' ? (
        <div className="border rounded-xl p-3 space-y-2">
          <textarea
            ref={textareaRef}
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (Ctrl+Enter to send)"
            className="w-full resize-none bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end">
            <Button size="sm" onClick={send} disabled={sending || !body.trim()}>
              <Send className="mr-1.5 h-3.5 w-3.5" />
              {sending ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-center text-muted-foreground py-3 border rounded-xl">
          This inquiry is {status.toLowerCase()} — no further messages.
        </p>
      )}
    </div>
  )
}
