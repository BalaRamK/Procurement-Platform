import type { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

export const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;
      const existing = await prisma.user.findUnique({
        where: { email: user.email },
      });
      if (existing && !existing.status) return false;
      if (!existing) {
        await prisma.user.create({
          data: {
            email: user.email,
            name: user.name ?? undefined,
            azure_id: account?.providerAccountId ?? undefined,
            role: UserRole.REQUESTER,
            status: true,
          },
        });
      } else if (account?.providerAccountId && !existing.azure_id) {
        await prisma.user.update({
          where: { id: existing.id },
          data: { azure_id: account.providerAccountId, name: user.name ?? undefined },
        });
      }
      return true;
    },
    async jwt({ token, account, profile, user }) {
      if (user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.id = dbUser.id;
          token.team = dbUser.team ?? undefined;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: session.user.email },
        });
        if (dbUser) {
          session.user.role = dbUser.role;
          session.user.id = dbUser.id;
          session.user.team = dbUser.team ?? null;
        } else {
          session.user.role = token.role ?? null;
          session.user.team = token.team ?? null;
          session.user.id = token.id ?? undefined;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
};
