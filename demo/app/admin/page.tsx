"use client"
import { useSession } from "next-auth/react"

// BUG: role check is client-side only — bypassable
export default function AdminPage() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return (
      <main className="min-h-[calc(100vh-56px)] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-zinc-600 border-t-white rounded-full animate-spin" />
      </main>
    )
  }

  if (((session?.user) as { role?: string })?.role !== "admin") {
    return (
      <main className="min-h-[calc(100vh-56px)] flex items-center justify-center px-6">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
            </svg>
          </div>
          <h1 className="text-white font-semibold">Access denied</h1>
          <p className="text-zinc-400 text-sm mt-1">This page is restricted to admins.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-[calc(100vh-56px)] bg-zinc-950">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-white">Admin Panel</h1>
          <p className="text-sm text-zinc-400 mt-1">Manage users and platform settings</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl">
          <div className="px-6 py-4 border-b border-zinc-800">
            <h2 className="font-medium text-white">Users</h2>
          </div>
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-zinc-400 text-sm">User management not implemented.</p>
          </div>
        </div>
      </div>
    </main>
  )
}
