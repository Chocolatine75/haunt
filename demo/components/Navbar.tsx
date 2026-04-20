"use client"
import Link from "next/link"
import { useSession, signOut } from "next-auth/react"

export default function Navbar() {
  const { data: session } = useSession()

  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold text-white tracking-tight">
          DemoApp
        </Link>
        <nav className="flex items-center gap-6 text-sm text-zinc-400">
          <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
          {session ? (
            <>
              <Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="hover:text-white transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-white transition-colors">Log in</Link>
              <Link
                href="/signup"
                className="bg-white text-black px-3 py-1.5 rounded-md text-sm font-medium hover:bg-zinc-200 transition-colors"
              >
                Get started
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
