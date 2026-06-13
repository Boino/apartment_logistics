import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

// Dev admin bypass: set DEV_ADMIN_PASSWORD in .env to log in without a database.
// Use any email + that password to get a full host+admin session.
const DEV_ADMIN_PASSWORD = process.env.DEV_ADMIN_PASSWORD

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        // Dev bypass — upserts a real row so foreign keys work
        if (DEV_ADMIN_PASSWORD && credentials.password === DEV_ADMIN_PASSWORD) {
          try {
            const user = await db.user.upsert({
              where: { email: credentials.email },
              update: { isHost: true },
              create: {
                id: 'dev-admin',
                name: 'Dev Admin',
                email: credentials.email,
                passwordHash: '',
                isHost: true,
              },
            })
            return { id: user.id, name: user.name, email: user.email, isHost: true }
          } catch {
            // DB not yet available — fall back to in-memory session only
            return { id: 'dev-admin', name: 'Dev Admin', email: credentials.email, isHost: true }
          }
        }

        try {
          const user = await db.user.findUnique({ where: { email: credentials.email } })
          if (!user) return null
          const valid = await bcrypt.compare(credentials.password, user.passwordHash)
          if (!valid) return null
          return { id: user.id, name: user.name, email: user.email, isHost: user.isHost }
        } catch {
          // DB not available
          return null
        }
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.isHost = (user as { isHost?: boolean }).isHost ?? false
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id as string
      session.user.isHost = token.isHost as boolean
      return session
    },
  },
  pages: { signIn: '/login' },
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
}
