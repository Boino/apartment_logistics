'use client'

import * as React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export default function RegisterPage() {
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [loading, setLoading] = React.useState(false)
  const [email, setEmail] = React.useState('')
  const [isHost, setIsHost] = React.useState(false)
  const [done, setDone] = React.useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrors({})
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const submittedEmail = fd.get('email') as string
    const body = {
      name: fd.get('name'),
      email: submittedEmail,
      password: fd.get('password'),
      isHost,
      consent: true,
    }
    let res: Response, json: Record<string, unknown> = {}
    try {
      res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      json = await res.json()
    } catch {
      setLoading(false)
      setErrors({ _: 'Could not reach the server. Is the database running?' })
      return
    }
    setLoading(false)
    if (!res.ok) {
      const err = (json as { error?: { fields?: Record<string, string>; message?: string } }).error
      setErrors(err?.fields ?? { _: err?.message ?? 'Registration failed' })
      return
    }
    setEmail(submittedEmail)
    setDone(true)
  }

  if (done) {
    return (
      <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle>Check your email</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              We sent a verification link to <strong>{email}</strong>.
              Click the link in the email to activate your account.
            </p>
            <p className="text-xs text-muted-foreground">
              The link expires in 24 hours. Check your spam folder if you don&apos;t see it.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">Go to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} method="post" className="space-y-4">
            <Input name="name" label="Full name" required autoComplete="name" error={errors.name} />
            <Input name="email" type="email" label="Email" required autoComplete="email" error={errors.email} />
            <Input name="password" type="password" label="Password" required autoComplete="new-password" error={errors.password} />
            {errors._ && <p className="text-sm text-destructive">{errors._}</p>}
            {/* Host toggle */}
            <label className="flex items-start gap-3 cursor-pointer select-none rounded-lg border p-3 hover:bg-muted/50 transition-colors">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
                checked={isHost}
                onChange={(e) => setIsHost(e.target.checked)}
              />
              <span className="text-sm">
                <span className="font-medium">I want to list a property</span>
                <span className="block text-xs text-muted-foreground mt-0.5">
                  Gives you access to the host dashboard to create and manage listings.
                </span>
              </span>
            </label>

            <p className="text-xs text-muted-foreground">
              By registering you accept our{' '}
              <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
            </p>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline">Sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
