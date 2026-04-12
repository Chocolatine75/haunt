import Link from "next/link"

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold">DemoApp</h1>
      <p className="text-gray-600 text-lg text-center max-w-md">
        The AI writing tool that helps you write faster, clearer, better.
      </p>
      <div className="flex gap-4">
        <Link href="/signup" className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800">
          Get started
        </Link>
        <Link href="/login" className="border border-gray-300 px-6 py-3 rounded-lg hover:bg-gray-50">
          Log in
        </Link>
      </div>
      <nav className="flex gap-6 text-sm text-gray-500 mt-8">
        <Link href="/pricing">Pricing</Link>
        <Link href="/dashboard">Dashboard</Link>
      </nav>
    </main>
  )
}
