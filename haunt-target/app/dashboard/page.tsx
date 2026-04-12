// BUG: no auth guard — loads for unauthenticated users
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
