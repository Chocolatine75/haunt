// BUG: no auth guard — loads for unauthenticated users
// Should call getServerSession and redirect to /login if no session
import Link from "next/link"

export default function DashboardPage() {
  return (
    <main className="min-h-[calc(100vh-56px)] bg-zinc-950">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
            <p className="text-sm text-zinc-400 mt-1">Your workspace</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/settings" className="text-sm text-zinc-400 hover:text-white transition-colors">Settings</Link>
            <Link href="/admin" className="text-sm text-zinc-400 hover:text-white transition-colors">Admin</Link>
            <button className="bg-white text-black px-4 py-2 rounded-lg text-sm font-medium hover:bg-zinc-200 transition-colors">
              New document
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-10">
          {[
            { label: "Documents", value: "0" },
            { label: "Words written", value: "0" },
            { label: "This month", value: "0" },
          ].map((s) => (
            <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <p className="text-sm text-zinc-400">{s.label}</p>
              <p className="text-3xl font-semibold text-white mt-1">{s.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl">
          <div className="px-6 py-4 border-b border-zinc-800">
            <h2 className="font-medium text-white">Recent documents</h2>
          </div>
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-zinc-400 text-sm">No documents yet</p>
            <p className="text-zinc-600 text-xs mt-1">Create your first document to get started</p>
          </div>
        </div>
      </div>
    </main>
  )
}
