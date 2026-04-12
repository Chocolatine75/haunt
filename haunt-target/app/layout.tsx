import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import SessionWrapper from "@/components/SessionWrapper"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "DemoApp — haunt-target",
  description: "Demo SaaS app for Haunt testing",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionWrapper session={session}>{children}</SessionWrapper>
      </body>
    </html>
  )
}
