'use client'

import { useState, useEffect, useCallback } from 'react'
import { NotificationBell, type NotificationItem } from '@/components/ui/notification-bell'
import { useRouter } from 'next/navigation'

export function NotificationWidget() {
  const router = useRouter()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      setNotifications(json.data.notifications)
      setUnreadCount(json.data.unreadCount)
    } catch {
      // silently fail — not critical
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    const id = setInterval(fetchNotifications, 30_000)
    return () => clearInterval(id)
  }, [fetchNotifications])

  async function handleRead(id: string) {
    await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    })
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)))
    setUnreadCount((c) => Math.max(0, c - 1))
    router.refresh()
  }

  return (
    <NotificationBell
      notifications={notifications}
      unreadCount={unreadCount}
      onRead={handleRead}
    />
  )
}
