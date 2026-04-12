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
