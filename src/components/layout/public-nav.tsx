'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Home, LayoutDashboard, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { NotificationWidget } from '@/modules/notifications/notification-widget'

export function PublicNav() {
  const { data: session, update } = useSession()
  const user = session?.user
  const router = useRouter()
  const [becomingHost, setBecomingHost] = React.useState(false)

  async function becomeHost() {
    setBecomingHost(true)
    await fetch('/api/account', { method: 'PATCH' })
    await update()
    router.push('/host')
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-primary">
          <Home className="h-5 w-5" />
          StayBase
        </Link>

        <nav className="flex items-center gap-2">
          {/* Mode switcher / become host */}
          {user?.isHost ? (
            <Button variant="outline" size="sm" asChild>
              <Link href="/host" className="flex items-center gap-1.5">
                <LayoutDashboard className="h-3.5 w-3.5" />
                Switch to hosting
              </Link>
            </Button>
          ) : user ? (
            <Button variant="outline" size="sm" onClick={becomeHost} disabled={becomingHost}>
              <LayoutDashboard className="mr-1.5 h-3.5 w-3.5" />
              {becomingHost ? 'Setting up…' : 'Become a host'}
            </Button>
          ) : null}

          {/* Visible inquiries link for signed-in guests */}
          {user && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/inquiries" className="flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5" />
                My inquiries
              </Link>
            </Button>
          )}

          {user && <NotificationWidget />}

          {user ? (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="flex items-center gap-2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{user.name?.charAt(0).toUpperCase() ?? '?'}</AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className="z-50 min-w-[160px] rounded-md border bg-popover p-1 shadow-md" align="end">
                  <div className="px-2 py-1.5 text-xs text-muted-foreground truncate">{user.email}</div>
                  <DropdownMenu.Separator className="my-1 h-px bg-border" />
                  <DropdownMenu.Item
                    className="flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm text-destructive outline-none hover:bg-accent"
                    onSelect={() => signOut({ callbackUrl: '/' })}
                  >
                    Sign out
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild><Link href="/login">Sign in</Link></Button>
              <Button size="sm" asChild><Link href="/register">Register</Link></Button>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
