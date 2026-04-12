import Link from "next/link"

export default function PricingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-3xl font-bold">Pricing</h1>
      <div className="flex gap-6">
        <div className="border rounded-xl p-6 w-64">
          <h2 className="font-semibold text-lg">Free</h2>
          <p className="text-3xl font-bold mt-2">$0</p>
          <p className="text-gray-500 mt-2">5 documents/month</p>
          <Link href="/signup" className="block mt-4 bg-black text-white text-center py-2 rounded">
            Get started
          </Link>
        </div>
        <div className="border rounded-xl p-6 w-64 border-black">
          <h2 className="font-semibold text-lg">Pro</h2>
          <p className="text-3xl font-bold mt-2">$12/mo</p>
          <p className="text-gray-500 mt-2">Unlimited documents</p>
          <Link href="/signup" className="block mt-4 bg-black text-white text-center py-2 rounded">
            Start free trial
          </Link>
        </div>
      </div>
    </main>
  )
}
