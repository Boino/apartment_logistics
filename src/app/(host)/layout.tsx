import { HostSidebar } from '@/components/layout/host-sidebar'

export default function HostLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <HostSidebar />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">{children}</main>
    </div>
  )
}
