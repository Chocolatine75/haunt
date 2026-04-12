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
