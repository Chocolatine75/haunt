import { NextResponse } from "next/server"

export async function POST() {
  // BUG: saves nothing, returns empty 200
  return NextResponse.json({})
}
