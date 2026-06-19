import { redirect } from 'next/navigation'

// Calendar is now embedded in each listing's edit page (Calendar tab).
// Redirect anyone who lands here directly.
export default function HostCalendarPage() {
  redirect('/host/listings')
}
