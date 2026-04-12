"use client"
import { useSession } from "next-auth/react"

// BUG: role check is client-side only — bypassable
export default function AdminPage() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return <p>Loading...</p>
  }

  if (((session?.user) as { role?: string })?.role !== "admin") {
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
