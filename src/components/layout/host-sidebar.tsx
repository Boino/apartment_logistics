'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Home, MessageSquare, Bed, Package, Users, Menu, X, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { NotificationWidget } from '@/modules/notifications/notification-widget'

const NAV_ITEMS = [
  { href: '/host', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/host/listings', label: 'Listings', icon: Home },
  { href: '/host/inquiries', label: 'Inquiries', icon: MessageSquare },
  { href: '/host/stays', label: 'Stays', icon: Bed },
  { href: '/host/logistics', label: 'Logistics', icon: Package },
  { href: '/host/staff', label: 'Staff', icon: Users },
]

export function HostSidebar() {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = React.useState(false)

  const nav = (
    <nav className="flex flex-col gap-1 p-2">
      {NAV_ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 border-r lg:block">
        <div className="sticky top-0 flex h-screen flex-col">
          <div className="flex h-16 items-center border-b px-4">
            <Link href="/" className="font-bold text-primary">StayBase</Link>
          </div>
          <div className="flex-1 overflow-y-auto">{nav}</div>
          <div className="border-t p-2 flex items-center gap-1">
            <Link
              href="/"
              className="flex flex-1 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Globe className="h-4 w-4" />
              Guest view
            </Link>
            <NotificationWidget />
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="fixed left-0 right-0 top-0 z-40 flex h-14 items-center border-b bg-background px-4 lg:hidden">
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
          <Menu className="h-5 w-5" />
        </Button>
        <span className="ml-2 font-bold text-primary">StayBase</span>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-56 flex-col border-r bg-background">
            <div className="flex h-14 items-center justify-between border-b px-4">
              <span className="font-bold text-primary">StayBase</span>
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}><X className="h-5 w-5" /></Button>
            </div>
            <div className="flex-1 overflow-y-auto">{nav}</div>
          </aside>
        </div>
      )}
    </>
  )
}
