import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"

export async function POST(req: Request) {
  const { email, password } = await req.json()

  // BUG: no server-side validation — accepts empty email
  try {
    await prisma.user.create({
      data: { email, password, role: "user" },
    })
    return NextResponse.json({ ok: true })
  } catch {
    // BUG: returns 500 with no user-facing message
    return NextResponse.json({ error: "signup failed" }, { status: 500 })
  }
}
