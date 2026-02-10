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
      // Use token claims only; skip Microsoft Graph profile-photo fetch (avoids fetch failures behind proxy).
      profile(profile: { sub?: string; name?: string; email?: string; preferred_username?: string }) {
        return {
          id: profile.sub ?? "",
          name: profile.name ?? profile.preferred_username ?? null,
          email: profile.email ?? profile.preferred_username ?? null,
          image: null,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;
      const email = (user.email as string).trim().toLowerCase();
      const profiles = await query<{ id: string; status: boolean; azureId: string | null }>(
        'SELECT id, status, azure_id AS "azureId" FROM users WHERE email = $1',
        [email]
      );
      const anyActive = profiles.some((p) => p.status);
      if (profiles.length > 0 && !anyActive) return false;
      if (profiles.length === 0) {
        await query(
          `INSERT INTO users (email, name, azure_id, roles, status)
           VALUES ($1, $2, $3, ARRAY['REQUESTER']::"UserRole"[], true)`,
          [email, user.name ?? null, account?.providerAccountId ?? null]
        );
      } else if (account?.providerAccountId && profiles.length > 0) {
        const first = profiles[0];
        if (!first.azureId) {
          await query(
            'UPDATE users SET azure_id = $1, name = COALESCE($2, name), updated_at = now() WHERE id = $3',
            [account.providerAccountId, user.name ?? null, first.id]
          );
        }
      }
      return true;
    },
    async jwt({ token, user, trigger, session: updateSession }) {
      if (trigger === "update" && updateSession?.selectedUserId) {
        token.selectedUserId = updateSession.selectedUserId as string;
        return token;
      }
      if (user?.email) {
        const email = (user.email as string).trim().toLowerCase();
        const profiles = await query<{ id: string; roles: string[]; team: string | null }>(
          'SELECT id, roles, team FROM users WHERE email = $1 ORDER BY created_at ASC',
          [email]
        );
        if (profiles.length > 0) {
          const selected = profiles[0];
          token.selectedUserId = selected.id;
          token.roles = asRolesArray(selected.roles);
          token.id = selected.id;
          token.team = (selected.team as TeamName) ?? undefined;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const selectedId = token.selectedUserId as string | undefined;
        const email = session.user.email?.trim().toLowerCase();
        if (email) {
          const profiles = await query<{ id: string; roles: string[]; team: string | null }>(
            'SELECT id, roles, team FROM users WHERE email = $1 ORDER BY created_at ASC',
            [email]
          );
          const selected = selectedId
            ? profiles.find((p) => p.id === selectedId)
            : profiles[0];
          if (selected) {
            session.user.roles = asRolesArray(selected.roles);
            session.user.id = selected.id;
            session.user.team = (selected.team ?? null) as TeamName | null;
          } else {
            session.user.roles = asRolesArray(token.roles);
            session.user.team = (token.team as TeamName) ?? null;
            session.user.id = token.id ?? undefined;
          }
        } else {
          session.user.roles = asRolesArray(token.roles);
          session.user.id = token.id ?? undefined;
          session.user.team = (token.team as TeamName) ?? null;
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
