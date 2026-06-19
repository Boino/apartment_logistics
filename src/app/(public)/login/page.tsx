'use client'

import * as React from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const returnTo = params.get('callbackUrl') ?? '/'
  const verified = params.get('verified') === '1'
  const tokenError = params.get('error')

  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const result = await signIn('credentials', {
      email: fd.get('email') as string,
      password: fd.get('password') as string,
      redirect: false,
    })
    setLoading(false)
    if (result?.error === 'UNVERIFIED_EMAIL') {
      setError('Please verify your email before signing in. Check your inbox for the verification link.')
    } else if (result?.error) {
      setError('Invalid email or password')
    } else {
      router.push(returnTo)
      router.refresh()
    }
  }

  return (
    <>
      {verified && (
        <div className="mb-4 rounded-md bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Email verified! You can now sign in.
        </div>
      )}
      {tokenError && !verified && (
        <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {tokenError === 'expired-token'
            ? 'Verification link has expired. Register again to get a new one.'
            : 'Invalid verification link.'}
        </div>
      )}
      <form onSubmit={handleSubmit} method="post" className="space-y-4">
        <Input name="email" type="email" label="Email" required autoComplete="email" />
        <Input name="password" type="password" label="Password" required autoComplete="current-password" />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <React.Suspense fallback={<div className="flex justify-center py-4"><Spinner /></div>}>
            <LoginForm />
          </React.Suspense>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            No account?{' '}
            <Link href="/register" className="text-primary hover:underline">Register</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
