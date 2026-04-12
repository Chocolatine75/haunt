import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./db"

interface UserWithRole {
  id: string
  email: string
  role: string
}

declare module "next-auth" {
  interface Session {
    user?: {
      email?: string | null
      role?: string
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        // BUG: password logged in plaintext — left from dev debugging
        console.log(`[auth] login: ${credentials.email} / ${credentials.password}`)

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })

        if (!user || user.password !== credentials.password) return null

        const userWithRole: UserWithRole = {
          id: user.id,
          email: user.email,
          role: user.role,
        }
        return userWithRole
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const userWithRole = user as UserWithRole
        token.role = userWithRole.role
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.role = token.role
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
}
