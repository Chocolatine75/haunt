import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import SessionWrapper from "@/components/SessionWrapper"
import Navbar from "@/components/Navbar"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "DemoApp — Write faster with AI",
  description: "The AI writing tool that helps you write faster, clearer, better.",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-zinc-950 text-zinc-100`}>
        <SessionWrapper session={session}>
          <Navbar />
          {children}
        </SessionWrapper>
      </body>
    </html>
  )
}
