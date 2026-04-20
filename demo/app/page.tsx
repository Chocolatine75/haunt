import Link from "next/link"

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-24">
      <div className="max-w-3xl w-full text-center space-y-6">
        <div className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-full px-4 py-1.5 text-sm text-zinc-400 mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          Now in public beta
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-white leading-tight">
          Write faster.<br />
          <span className="text-zinc-400">Think clearer.</span>
        </h1>

        <p className="text-lg text-zinc-400 max-w-xl mx-auto text-balance">
          DemoApp uses AI to help you draft, edit, and publish content in a fraction of the time.
          From first draft to final copy, in one place.
        </p>

        <div className="flex items-center justify-center gap-3 pt-2">
          <Link
            href="/signup"
            className="bg-white text-black px-5 py-2.5 rounded-lg font-medium hover:bg-zinc-200 transition-colors"
          >
            Get started free
          </Link>
          <Link
            href="/pricing"
            className="text-zinc-400 px-5 py-2.5 rounded-lg hover:text-white transition-colors"
          >
            See pricing →
          </Link>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-16 text-left">
          {[
            { title: "AI drafts", desc: "Generate first drafts from a single prompt." },
            { title: "Smart edits", desc: "Rewrite, shorten, or improve any selection." },
            { title: "One-click publish", desc: "Export to Notion, Markdown, or your CMS." },
          ].map((f) => (
            <div key={f.title} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h3 className="font-semibold text-white mb-1">{f.title}</h3>
              <p className="text-sm text-zinc-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}
