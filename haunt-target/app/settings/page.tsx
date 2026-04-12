"use client"
import { useState } from "react"

// BUG: after saving, no success message, no error message
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
    // BUG: no state update here — nothing shown after save
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
        {/* BUG: no success/error element */}
      </form>
    </main>
  )
}
