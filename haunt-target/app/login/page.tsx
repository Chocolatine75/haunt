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
    <main className="min-h-[calc(100vh-56px)] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 space-y-5">
          <div>
            <h1 className="text-xl font-semibold text-white">Welcome back</h1>
            <p className="text-sm text-zinc-400 mt-1">Sign in to your account</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

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
            {/* BUG: no disabled={loading} here */}
            <button
              type="submit"
              className="w-full bg-white text-black py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-200 transition-colors"
            >
              Sign in
            </button>
          </form>

          <p className="text-sm text-zinc-500 text-center">
            No account?{" "}
            <Link href="/signup" className="text-zinc-300 hover:text-white transition-colors">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
