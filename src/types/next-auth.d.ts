import { UserRole, TeamName } from "@prisma/client";
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      role?: UserRole | null;
      team?: TeamName | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole | null;
    team?: TeamName | null;
    id?: string;
  }
}
