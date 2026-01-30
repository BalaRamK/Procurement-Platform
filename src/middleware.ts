import { withAuth } from "next-auth/middleware";

/**
 * Middleware only checks that the user is signed in (has a token).
 * Role checks (e.g. SUPER_ADMIN for /admin) are done in layout/page via getServerSession,
 * which fetches fresh role from DB so role changes take effect without re-sign-in.
 */
export default withAuth({
  callbacks: {
    authorized: ({ token }) => !!token,
  },
  pages: { signIn: "/auth/signin" },
});

export const config = {
  matcher: ["/", "/dashboard/:path*", "/admin/:path*", "/requests/:path*"],
};
