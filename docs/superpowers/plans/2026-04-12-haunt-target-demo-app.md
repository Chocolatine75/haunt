# haunt-target Demo App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a realistic Next.js 14 SaaS app with intentional bugs that Haunt can find, serving as the official test target for validating all Haunt features including auth.

**Architecture:** Next.js 14 App Router + NextAuth credentials provider + Prisma/SQLite. All routes are present, auth middleware intentionally leaves `/dashboard` unprotected. Bugs are marked with `// BUG:` comments so they're visible in code review but invisible to end users.

**Tech Stack:** Next.js 14, TypeScript, NextAuth v4, Prisma 5, SQLite, Tailwind CSS

---

## File Structure

```
haunt-target/
├── package.json
├── next.config.js
├── tsconfig.json
├── .env.local                          # NEXTAUTH_SECRET + NEXTAUTH_URL
├── prisma/
│   ├── schema.prisma                   # User model (id, email, password, role)
│   └── seed.ts                         # Creates test@example.com + admin@example.com
├── lib/
│   ├── auth.ts                         # NextAuth config (credentials provider + JWT callbacks)
│   └── db.ts                           # Prisma client singleton
├── app/
│   ├── layout.tsx                      # Root layout with SessionProvider
│   ├── page.tsx                        # Landing page with signup CTA
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts # NextAuth handler
│   │   ├── signup/route.ts             # POST /api/signup — creates user, no validation
│   │   └── settings/route.ts           # POST /api/settings — no-op, no response body
│   ├── signup/page.tsx                 # BUG: accepts empty email, no error feedback
│   ├── login/page.tsx                  # BUG: button not disabled on submit (double-submit)
│   ├── dashboard/page.tsx              # BUG: no auth guard, loads for anyone
│   ├── settings/page.tsx               # BUG: save shows no success/error feedback
│   └── admin/page.tsx                  # BUG: role check is client-side only
└── middleware.ts                       # Protects /settings + /admin only (leaves /dashboard open)
```

---

## Task 1: Initialize the project

**Files:**
- Create: `haunt-target/` (directory via create-next-app)

- [ ] **Step 1: Scaffold the Next.js app**

Run from `haunt-target/` parent directory (the haunt repo root):

```bash
npx create-next-app@14 haunt-target --typescript --eslint --tailwind --app --no-src-dir --import-alias "@/*" --use-npm
```

Expected: directory `haunt-target/` created with Next.js 14.

- [ ] **Step 2: Install additional dependencies**

```bash
cd haunt-target && npm install next-auth @prisma/client && npm install -D prisma ts-node @types/bcryptjs
```

- [ ] **Step 3: Verify install**

```bash
cd haunt-target && npm run build 2>&1 | tail -5
```

Expected: build succeeds (no errors).

- [ ] **Step 4: Commit**

```bash
git add haunt-target/
git commit -m "feat(haunt-target): scaffold Next.js 14 app"
```

---

## Task 2: Prisma schema + database

**Files:**
- Create: `haunt-target/prisma/schema.prisma`
- Create: `haunt-target/prisma/seed.ts`
- Create: `haunt-target/lib/db.ts`

- [ ] **Step 1: Write the Prisma schema**

`haunt-target/prisma/schema.prisma`:

```prisma
datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  role      String   @default("user")
  createdAt DateTime @default(now())
}
```

- [ ] **Step 2: Write the Prisma client singleton**

`haunt-target/lib/db.ts`:

```typescript
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error"],
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
```

- [ ] **Step 3: Write the seed script**

`haunt-target/prisma/seed.ts`:

```typescript
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  await prisma.user.upsert({
    where: { email: "test@example.com" },
    update: {},
    create: {
      email: "test@example.com",
      password: "password123",
      role: "user",
    },
  })

  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      password: "admin123",
      role: "admin",
    },
  })

  console.log("Seed complete: test@example.com / password123, admin@example.com / admin123")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

- [ ] **Step 4: Add seed config to package.json**

Add to `haunt-target/package.json`:

```json
"prisma": {
  "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
}
```

- [ ] **Step 5: Push schema + seed**

```bash
cd haunt-target && npx prisma db push && npx prisma db seed
```

Expected output:
```
The SQLite database "dev.db" from "file:./dev.db" was successfully created.
Seed complete: test@example.com / password123, admin@example.com / admin123
```

- [ ] **Step 6: Commit**

```bash
git add haunt-target/prisma/ haunt-target/lib/db.ts
git commit -m "feat(haunt-target): add Prisma schema + seed (two users: test + admin)"
```

---

## Task 3: NextAuth setup

**Files:**
- Create: `haunt-target/lib/auth.ts`
- Create: `haunt-target/app/api/auth/[...nextauth]/route.ts`
- Create: `haunt-target/.env.local`

- [ ] **Step 1: Create .env.local**

`haunt-target/.env.local`:

```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=haunt-dev-secret-not-for-production
```

- [ ] **Step 2: Write NextAuth config**

`haunt-target/lib/auth.ts`:

```typescript
import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./db"

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

        return { id: user.id, email: user.email, role: user.role } as any
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.role = (user as any).role
      return token
    },
    session({ session, token }) {
      if (session.user) (session.user as any).role = token.role
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
}
```

- [ ] **Step 3: Wire up the API route**

`haunt-target/app/api/auth/[...nextauth]/route.ts`:

```typescript
import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }
```

- [ ] **Step 4: Commit**

```bash
git add haunt-target/lib/auth.ts haunt-target/app/api/auth/ haunt-target/.env.local
git commit -m "feat(haunt-target): add NextAuth credentials provider with intentional console.log bug"
```

---

## Task 4: Root layout + landing page

**Files:**
- Modify: `haunt-target/app/layout.tsx`
- Modify: `haunt-target/app/page.tsx`

- [ ] **Step 1: Update root layout with SessionProvider**

`haunt-target/app/layout.tsx`:

```typescript
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import SessionWrapper from "@/components/SessionWrapper"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "DemoApp — haunt-target",
  description: "Demo SaaS app for Haunt testing",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionWrapper session={session}>{children}</SessionWrapper>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Create SessionWrapper component**

`haunt-target/components/SessionWrapper.tsx`:

```typescript
"use client"
import { SessionProvider } from "next-auth/react"
import { Session } from "next-auth"

export default function SessionWrapper({
  children,
  session,
}: {
  children: React.ReactNode
  session: Session | null
}) {
  return <SessionProvider session={session}>{children}</SessionProvider>
}
```

- [ ] **Step 3: Write the landing page**

`haunt-target/app/page.tsx`:

```typescript
import Link from "next/link"

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold">DemoApp</h1>
      <p className="text-gray-600 text-lg text-center max-w-md">
        The AI writing tool that helps you write faster, clearer, better.
      </p>
      <div className="flex gap-4">
        <Link href="/signup" className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800">
          Get started
        </Link>
        <Link href="/login" className="border border-gray-300 px-6 py-3 rounded-lg hover:bg-gray-50">
          Log in
        </Link>
      </div>
      <nav className="flex gap-6 text-sm text-gray-500 mt-8">
        <Link href="/pricing">Pricing</Link>
        <Link href="/dashboard">Dashboard</Link>
      </nav>
    </main>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add haunt-target/app/layout.tsx haunt-target/app/page.tsx haunt-target/components/
git commit -m "feat(haunt-target): landing page + layout with SessionProvider"
```

---

## Task 5: Signup page (with bugs)

**Files:**
- Create: `haunt-target/app/signup/page.tsx`
- Create: `haunt-target/app/api/signup/route.ts`

- [ ] **Step 1: Write the API route**

`haunt-target/app/api/signup/route.ts`:

```typescript
import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function POST(req: Request) {
  const { email, password } = await req.json()

  // BUG: no server-side validation — accepts empty email, creates user with blank email
  try {
    await prisma.user.create({
      data: { email, password, role: "user" },
    })
    return NextResponse.json({ ok: true })
  } catch {
    // BUG: returns 500 with no user-facing message
    return NextResponse.json({ error: "signup failed" }, { status: 500 })
  }
}
```

- [ ] **Step 2: Write the signup page**

`haunt-target/app/signup/page.tsx`:

```typescript
"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

// BUG: no client-side validation before submit
// BUG: silent failure — no error shown when API returns 500
export default function SignupPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // BUG: submits even if email is empty — should check here
    const res = await fetch("/api/signup", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      headers: { "Content-Type": "application/json" },
    })
    if (res.ok) {
      router.push("/login")
    }
    // BUG: if res is not ok, nothing happens — user sees no feedback
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm p-8 border rounded-xl">
        <h1 className="text-2xl font-bold">Create account</h1>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="border rounded px-3 py-2"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="border rounded px-3 py-2"
        />
        <button type="submit" className="bg-black text-white py-2 rounded">
          Create account
        </button>
        <p className="text-sm text-gray-500">
          Already have an account? <Link href="/login" className="underline">Log in</Link>
        </p>
      </form>
    </main>
  )
}
```

- [ ] **Step 3: Verify the bug is present**

```bash
cd haunt-target && npm run dev &
# In browser: go to http://localhost:3000/signup
# Click "Create account" without filling anything
# Expected: form submits silently — no error message shown (the bug)
```

- [ ] **Step 4: Commit**

```bash
git add haunt-target/app/signup/ haunt-target/app/api/signup/
git commit -m "feat(haunt-target): signup page with intentional validation bugs"
```

---

## Task 6: Login page (with bugs)

**Files:**
- Create: `haunt-target/app/login/page.tsx`

- [ ] **Step 1: Write the login page**

`haunt-target/app/login/page.tsx`:

```typescript
"use client"
import { signIn } from "next-auth/react"
import { useState } from "react"
import Link from "next/link"

// BUG: submit button not disabled during loading — allows double-submit
export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    // BUG: no loading state set — button stays enabled during the async call
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    })
    if (result?.error) {
      setError("Invalid email or password")
    } else {
      window.location.href = "/dashboard"
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-sm p-8 border rounded-xl">
        <h1 className="text-2xl font-bold">Log in</h1>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="border rounded px-3 py-2"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="border rounded px-3 py-2"
        />
        {/* BUG: no disabled={loading} here */}
        <button type="submit" className="bg-black text-white py-2 rounded">
          Log in
        </button>
        <p className="text-sm text-gray-500">
          No account? <Link href="/signup" className="underline">Sign up</Link>
        </p>
      </form>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add haunt-target/app/login/
git commit -m "feat(haunt-target): login page with intentional double-submit bug"
```

---

## Task 7: Dashboard page (missing auth guard)

**Files:**
- Create: `haunt-target/app/dashboard/page.tsx`

- [ ] **Step 1: Write the dashboard — intentionally without auth check**

`haunt-target/app/dashboard/page.tsx`:

```typescript
// BUG: no auth guard — this page loads for unauthenticated users
// Should call getServerSession and redirect to /login if no session
import Link from "next/link"

export default function DashboardPage() {
  return (
    <main className="min-h-screen p-8">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <nav className="flex gap-4">
          <Link href="/settings" className="text-gray-600 hover:underline">Settings</Link>
          <Link href="/admin" className="text-gray-600 hover:underline">Admin</Link>
        </nav>
      </header>
      <section>
        <h2 className="text-lg font-semibold mb-4">Your documents</h2>
        <p className="text-gray-500">No documents yet. Start writing to see them here.</p>
      </section>
    </main>
  )
}
```

- [ ] **Step 2: Verify the bug**

```bash
# Open incognito / clear cookies
# Navigate to http://localhost:3000/dashboard
# Expected: page loads and shows dashboard content (the bug — should redirect to /login)
```

- [ ] **Step 3: Commit**

```bash
git add haunt-target/app/dashboard/
git commit -m "feat(haunt-target): dashboard page — intentionally missing auth guard"
```

---

## Task 8: Settings page (no save feedback)

**Files:**
- Create: `haunt-target/app/settings/page.tsx`
- Create: `haunt-target/app/api/settings/route.ts`

- [ ] **Step 1: Write the API route (silent no-op)**

`haunt-target/app/api/settings/route.ts`:

```typescript
import { NextResponse } from "next/server"

export async function POST() {
  // BUG: saves nothing, returns empty 200 — no success/error body
  return NextResponse.json({})
}
```

- [ ] **Step 2: Write the settings page**

`haunt-target/app/settings/page.tsx`:

```typescript
"use client"
import { useState } from "react"

// BUG: after saving, no success message, no error message — user has no feedback
export default function SettingsPage() {
  const [name, setName] = useState("")
  const [bio, setBio] = useState("")

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    await fetch("/api/settings", {
      method: "POST",
      body: JSON.stringify({ name, bio }),
      headers: { "Content-Type": "application/json" },
    })
    // BUG: no state update here — nothing shown after save completes
  }

  return (
    <main className="min-h-screen p-8 max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Display name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border rounded px-3 py-2 w-full"
            placeholder="Your name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="border rounded px-3 py-2 w-full"
            rows={3}
            placeholder="Tell us about yourself"
          />
        </div>
        <button type="submit" className="bg-black text-white py-2 rounded w-fit px-6">
          Save
        </button>
        {/* BUG: no success/error element here */}
      </form>
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add haunt-target/app/settings/ haunt-target/app/api/settings/
git commit -m "feat(haunt-target): settings page — intentionally missing save feedback"
```

---

## Task 9: Admin page (client-side role check only)

**Files:**
- Create: `haunt-target/app/admin/page.tsx`

- [ ] **Step 1: Write the admin page with client-only role check**

`haunt-target/app/admin/page.tsx`:

```typescript
"use client"
import { useSession } from "next-auth/react"

// BUG: role check happens client-side only
// A user can bypass this by modifying the session token or the DOM
// Should use getServerSession server-side and return 403 for non-admins
export default function AdminPage() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return <p>Loading...</p>
  }

  // BUG: this check is easily bypassed — move to server-side
  if ((session?.user as any)?.role !== "admin") {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Access denied. Admins only.</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-6">Admin Panel</h1>
      <section>
        <h2 className="text-lg font-semibold mb-4">Users</h2>
        <p className="text-gray-500">User management interface. (Not implemented.)</p>
      </section>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add haunt-target/app/admin/
git commit -m "feat(haunt-target): admin page — intentionally client-side-only role check"
```

---

## Task 10: Middleware (intentionally incomplete)

**Files:**
- Create: `haunt-target/middleware.ts`

- [ ] **Step 1: Write middleware that protects settings + admin but leaves dashboard open**

`haunt-target/middleware.ts`:

```typescript
import { withAuth } from "next-auth/middleware"

// BUG: /dashboard is intentionally missing from the matcher
// All authenticated routes should be listed here
export default withAuth({
  pages: {
    signIn: "/login",
  },
})

export const config = {
  // BUG: /dashboard/:path* is intentionally omitted
  matcher: ["/settings/:path*", "/admin/:path*"],
}
```

- [ ] **Step 2: Commit**

```bash
git add haunt-target/middleware.ts
git commit -m "feat(haunt-target): middleware — intentionally leaves /dashboard unprotected"
```

---

## Task 11: README + pricing stub

**Files:**
- Create: `haunt-target/README.md`
- Create: `haunt-target/app/pricing/page.tsx`

- [ ] **Step 1: Write a pricing stub (so Haunt has a 4th real route to discover)**

`haunt-target/app/pricing/page.tsx`:

```typescript
import Link from "next/link"

export default function PricingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-3xl font-bold">Pricing</h1>
      <div className="flex gap-6">
        <div className="border rounded-xl p-6 w-64">
          <h2 className="font-semibold text-lg">Free</h2>
          <p className="text-3xl font-bold mt-2">$0</p>
          <p className="text-gray-500 mt-2">5 documents/month</p>
          <Link href="/signup" className="block mt-4 bg-black text-white text-center py-2 rounded">
            Get started
          </Link>
        </div>
        <div className="border rounded-xl p-6 w-64 border-black">
          <h2 className="font-semibold text-lg">Pro</h2>
          <p className="text-3xl font-bold mt-2">$12/mo</p>
          <p className="text-gray-500 mt-2">Unlimited documents</p>
          <Link href="/signup" className="block mt-4 bg-black text-white text-center py-2 rounded">
            Start free trial
          </Link>
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Write the README**

`haunt-target/README.md`:

```markdown
# haunt-target

A demo SaaS app for testing the [Haunt](https://github.com/Chocolatine75/haunt) Claude Code plugin.

## Quick start

\`\`\`bash
npm install
npx prisma db push
npx prisma db seed
npm run dev
\`\`\`

App runs at http://localhost:3000

## Test credentials

| Email | Password | Role |
|---|---|---|
| test@example.com | password123 | user |
| admin@example.com | admin123 | admin |

## Running Haunt against this app

\`\`\`bash
# Basic test
/haunt:haunt-test http://localhost:3000

# With auth
/haunt:haunt-test http://localhost:3000 --email test@example.com --password password123

# Full sweep
/haunt:haunt-test http://localhost:3000 --personas confused-beginner,malicious-user,screen-reader-user
\`\`\`

## Known intentional bugs

These bugs are present by design so Haunt has real issues to find:

- `/signup` — accepts empty email with no error message
- `/dashboard` — loads for unauthenticated users (middleware doesn't protect it)
- `/admin` — role check is client-side only (bypassable)
- `/login` — double-submit possible (button not disabled during async)
- `/settings` — save shows no success or error feedback
- `lib/auth.ts` — password logged in plaintext via console.log
```

- [ ] **Step 3: Final build check**

```bash
cd haunt-target && npm run build 2>&1 | tail -10
```

Expected: build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add haunt-target/app/pricing/ haunt-target/README.md
git commit -m "feat(haunt-target): pricing page + README with test credentials and known bugs"
```

---

## Task 12: End-to-end validation with Haunt

This is the final smoke test — run Haunt against haunt-target and verify it finds real bugs.

- [ ] **Step 1: Start the app**

```bash
cd haunt-target && npm run dev
```

Expected: server running at http://localhost:3000

- [ ] **Step 2: Run basic Haunt test (unauthenticated)**

```bash
/haunt:haunt-test http://localhost:3000
```

Expected: Haunt discovers routes including `/signup`, `/login`, `/dashboard`, `/pricing`. Finds at least the `/dashboard` auth bug and the `/signup` validation bug.

- [ ] **Step 3: Run with auth**

```bash
/haunt:haunt-test http://localhost:3000 --email test@example.com --password password123
```

Expected: Haunt logs in successfully, then tests authenticated routes including `/settings` and `/admin`.

- [ ] **Step 4: Commit final state**

```bash
git add -A && git commit -m "feat(haunt-target): complete demo SaaS app — validated with Haunt"
```
