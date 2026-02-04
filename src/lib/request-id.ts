import type { TeamName } from "@/types/db";
import { queryOne } from "@/lib/db";

const TEAM_PREFIX: Record<TeamName, string> = {
  INNOVATION: "IN",
  ENGINEERING: "EN",
  SALES: "SA",
};

/** Generate a unique requestId: prefix (IN|EN|SA) + 6 digits */
export async function generateRequestId(teamName: TeamName): Promise<string> {
  const prefix = TEAM_PREFIX[teamName];
  for (let attempt = 0; attempt < 50; attempt++) {
    const num = Math.floor(100000 + Math.random() * 900000);
    const requestId = `${prefix}${num}`;
    const existing = await queryOne<{ id: string }>(
      "SELECT id FROM tickets WHERE request_id = $1",
      [requestId]
    );
    if (!existing) return requestId;
  }
  throw new Error("Could not generate unique requestId");
}
