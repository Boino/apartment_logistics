import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getThreadByInquiry, markThreadRead } from '@/modules/inquiries/service'
import { ThreadView } from '@/components/inquiries/thread-view'

export const dynamic = 'force-dynamic'

export default async function HostInquiryThreadPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect(`/login?callbackUrl=/host/inquiries/${params.id}`)

  let thread: Awaited<ReturnType<typeof getThreadByInquiry>>
  try {
    thread = await getThreadByInquiry(params.id, session.user.id)
  } catch (err) {
    const status = (err as { status?: number }).status
    if (status === 404 || status === 403) notFound()
    throw err
  }

  await markThreadRead(thread.id, session.user.id)

  const messages = thread.messages.map((m) => ({
    ...m,
    createdAt: m.createdAt.toISOString(),
  }))

  return (
    <div className="container mx-auto max-w-2xl px-4 py-6 flex flex-col h-[calc(100vh-4rem)]">
      <div className="mb-4">
        <Link
          href="/host/inquiries"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          All inquiries
        </Link>
      </div>

      <ThreadView
        threadId={thread.id}
        inquiry={{
          ...thread.inquiry,
          checkinDate: thread.inquiry.checkinDate.toISOString(),
          checkoutDate: thread.inquiry.checkoutDate.toISOString(),
        }}
        initialMessages={messages}
        currentUserId={session.user.id}
        isHost={true}
      />
    </div>
  )
}
