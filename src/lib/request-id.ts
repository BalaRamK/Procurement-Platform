import type { TeamName } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const TEAM_PREFIX: Record<TeamName, string> = {
  INNOVATION: "IN",
  ENGINEERING: "EN",
  SALES: "SA",
};

/** Generate a unique requestId: prefix (IN|EN|SA) + 6 digits */
export async function generateRequestId(teamName: TeamName): Promise<string> {
  const prefix = TEAM_PREFIX[teamName];
  for (let attempt = 0; attempt < 50; attempt++) {
    const num = Math.floor(100000 + Math.random() * 900000); // 100000–999999
    const requestId = `${prefix}${num}`;
    const existing = await prisma.ticket.findUnique({
      where: { requestId },
      select: { id: true },
    });
    if (!existing) return requestId;
  }
  throw new Error("Could not generate unique requestId");
}
