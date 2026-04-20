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
    <main className="min-h-[calc(100vh-56px)] bg-zinc-950">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-white">Settings</h1>
          <p className="text-sm text-zinc-400 mt-1">Manage your account preferences</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl divide-y divide-zinc-800">
          <div className="p-6">
            <h2 className="text-sm font-medium text-white mb-4">Profile</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">Display name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1.5">Bio</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition-colors resize-none"
                  rows={3}
                  placeholder="Tell us about yourself"
                />
              </div>
              <button
                type="submit"
                className="bg-white text-black px-5 py-2 rounded-lg text-sm font-medium hover:bg-zinc-200 transition-colors"
              >
                Save changes
              </button>
              {/* BUG: no success/error element */}
            </form>
          </div>

          <div className="p-6">
            <h2 className="text-sm font-medium text-white mb-1">Danger zone</h2>
            <p className="text-sm text-zinc-400 mb-4">Permanently delete your account and all data.</p>
            <button className="border border-red-500/30 text-red-400 px-5 py-2 rounded-lg text-sm hover:bg-red-500/10 transition-colors">
              Delete account
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
