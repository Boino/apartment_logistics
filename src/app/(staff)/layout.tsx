import { StaffTabs } from '@/components/layout/staff-tabs'

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <StaffTabs />
      <main className="flex-1 p-4">{children}</main>
    </div>
  )
}
