'use client'

import * as React from 'react'
import { Bell } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { Button } from './button'

export interface NotificationItem {
  id: string
  title: string
  body: string
  link?: string | null
  readAt?: Date | string | null
  createdAt: Date | string
}

interface NotificationBellProps {
  notifications: NotificationItem[]
  unreadCount?: number
  onRead?: (id: string) => void
  className?: string
}

export function NotificationBell({ notifications, unreadCount = 0, onRead, className }: NotificationBellProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <div className={cn('relative', className)}>
      <Button variant="ghost" size="icon" onClick={() => setOpen((o) => !o)} aria-label="Notifications">
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-md border bg-popover shadow-lg">
          <div className="border-b px-4 py-2">
            <h4 className="text-sm font-semibold">Notifications</h4>
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-muted-foreground">No notifications</li>
            ) : (
              notifications.map((n) => (
                <li
                  key={n.id}
                  className={cn('cursor-pointer px-4 py-3 hover:bg-accent', !n.readAt && 'bg-primary/5')}
                  onClick={() => {
                    onRead?.(n.id)
                    if (n.link) window.location.href = n.link
                  }}
                >
                  <p className={cn('text-sm', !n.readAt && 'font-medium')}>{n.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </p>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
