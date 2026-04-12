import { withAuth } from "next-auth/middleware"

// BUG: /dashboard is intentionally missing from the matcher
// All authenticated routes should be listed here
export default withAuth({
  pages: {
    signIn: "/login",
  },
})

export const config = {
  // BUG: /dashboard/:path* is intentionally omitted
  matcher: ["/settings/:path*", "/admin/:path*"],
}
