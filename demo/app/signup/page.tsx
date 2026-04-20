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
    <main className="min-h-[calc(100vh-56px)] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 space-y-5">
          <div>
            <h1 className="text-xl font-semibold text-white">Create your account</h1>
            <p className="text-sm text-zinc-400 mt-1">Start writing for free, no card required</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
            />
            <button
              type="submit"
              className="w-full bg-white text-black py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-200 transition-colors"
            >
              Create account
            </button>
          </form>

          <p className="text-sm text-zinc-500 text-center">
            Already have an account?{" "}
            <Link href="/login" className="text-zinc-300 hover:text-white transition-colors">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
