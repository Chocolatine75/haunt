import Link from "next/link"

export default function PricingPage() {
  return (
    <main className="min-h-[calc(100vh-56px)] flex flex-col items-center justify-center px-6 py-24">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-white">Simple pricing</h1>
        <p className="text-zinc-400 mt-3">Start free. Upgrade when you need more.</p>
      </div>

      <div className="flex gap-6 items-stretch">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 w-72 flex flex-col">
          <div className="mb-6">
            <h2 className="font-semibold text-white text-lg">Free</h2>
            <p className="text-zinc-400 text-sm mt-1">For individuals getting started</p>
          </div>
          {/* BUG: $$0 — double dollar sign */}
          <p className="text-4xl font-bold text-white mb-1">$$0</p>
          <p className="text-zinc-500 text-sm mb-6">per month</p>
          <ul className="space-y-2 text-sm text-zinc-400 mb-8 flex-1">
            <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> 5 documents/month</li>
            <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> Basic AI editing</li>
            <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> Markdown export</li>
          </ul>
          <Link
            href="/signup"
            className="block text-center border border-zinc-700 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors"
          >
            Get started
          </Link>
        </div>

        <div className="bg-white rounded-2xl p-8 w-72 flex flex-col relative">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="bg-zinc-900 text-white text-xs font-medium px-3 py-1 rounded-full border border-zinc-700">
              Most popular
            </span>
          </div>
          <div className="mb-6">
            <h2 className="font-semibold text-zinc-900 text-lg">Pro</h2>
            <p className="text-zinc-500 text-sm mt-1">For professionals and teams</p>
          </div>
          <p className="text-4xl font-bold text-zinc-900 mb-1">$12</p>
          <p className="text-zinc-400 text-sm mb-6">per month</p>
          <ul className="space-y-2 text-sm text-zinc-600 mb-8 flex-1">
            <li className="flex items-center gap-2"><span className="text-emerald-600">✓</span> Unlimited documents</li>
            <li className="flex items-center gap-2"><span className="text-emerald-600">✓</span> Advanced AI models</li>
            <li className="flex items-center gap-2"><span className="text-emerald-600">✓</span> All export formats</li>
            <li className="flex items-center gap-2"><span className="text-emerald-600">✓</span> Priority support</li>
          </ul>
          <Link
            href="/signup"
            className="block text-center bg-zinc-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-zinc-800 transition-colors"
          >
            Start free trial
          </Link>
        </div>
      </div>
    </main>
  )
}
