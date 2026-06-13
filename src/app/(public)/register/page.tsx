'use client'

import * as React from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

export default function RegisterPage() {
  const router = useRouter()
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [loading, setLoading] = React.useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrors({})
    setLoading(true)
    const fd = new FormData(e.currentTarget)
    const body = {
      name: fd.get('name'),
      email: fd.get('email'),
      password: fd.get('password'),
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
    await signIn('credentials', { email: body.email, password: body.password, redirect: false })
    router.push('/')
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Create account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input name="name" label="Full name" required autoComplete="name" error={errors.name} />
            <Input name="email" type="email" label="Email" required autoComplete="email" error={errors.email} />
            <Input name="password" type="password" label="Password" required autoComplete="new-password" error={errors.password} />
            {errors._ && <p className="text-sm text-destructive">{errors._}</p>}
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
