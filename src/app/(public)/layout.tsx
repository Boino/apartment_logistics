import { PublicNav } from '@/components/layout/public-nav'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />
      <main className="flex-1">{children}</main>
      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        <a href="/privacy" className="hover:underline">
          Privacy Policy
        </a>
        <span className="mx-2">·</span>
        <span>© {new Date().getFullYear()} StayBase</span>
      </footer>
    </div>
  )
}
