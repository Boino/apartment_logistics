import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { NewListingWizard } from './wizard'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'New Listing' }

export default async function NewListingPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')
  return <NewListingWizard />
}
