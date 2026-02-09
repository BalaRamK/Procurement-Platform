import "@/lib/proxy"; // apply HTTP/HTTPS proxy from env before any outbound requests
import type { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import { query, queryOne } from "@/lib/db";
import type { UserRole, TeamName } from "@/types/db";
import { asRolesArray } from "@/types/db";
import { getProxyAgent } from "@/lib/node-proxy-agent";

const proxyAgent = getProxyAgent();

export const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
      ...(proxyAgent && { httpOptions: { agent: proxyAgent } }),
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;
      const existing = await queryOne<{ id: string; status: boolean; azureId: string | null }>(
        'SELECT id, status, azure_id AS "azureId" FROM users WHERE email = $1',
        [user.email]
      );
      if (existing && !existing.status) return false;
      if (!existing) {
        await query(
          `INSERT INTO users (email, name, azure_id, roles, status)
           VALUES ($1, $2, $3, ARRAY['REQUESTER']::"UserRole"[], true)`,
          [user.email, user.name ?? null, account?.providerAccountId ?? null]
        );
      } else if (account?.providerAccountId && !existing.azureId) {
        await query(
          'UPDATE users SET azure_id = $1, name = COALESCE($2, name), updated_at = now() WHERE id = $3',
          [account.providerAccountId, user.name ?? null, existing.id]
        );
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const dbUser = await queryOne<{ id: string; roles: string[]; team: string | null }>(
          'SELECT id, roles, team FROM users WHERE email = $1',
          [user.email]
        );
        if (dbUser) {
          token.roles = (dbUser.roles ?? []) as UserRole[];
          token.id = dbUser.id;
          token.team = (dbUser.team as TeamName) ?? undefined;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user?.email) {
        const dbUser = await queryOne<{ id: string; roles: string[]; team: string | null }>(
          'SELECT id, roles, team FROM users WHERE email = $1',
          [session.user.email]
        );
        if (dbUser) {
          session.user.roles = asRolesArray(dbUser.roles);
          session.user.id = dbUser.id;
          session.user.team = (dbUser.team ?? null) as TeamName | null;
        } else {
          session.user.roles = asRolesArray(token.roles);
          session.user.team = (token.team as TeamName) ?? null;
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
