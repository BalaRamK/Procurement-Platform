/**
 * Backfill requestId for existing tickets (IN/EN/SA + 6 digits).
 * Usage: npx tsx scripts/backfill-request-ids.ts
 * Requires DATABASE_URL in .env
 */
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";
import type { TeamName } from "@prisma/client";

const prisma = new PrismaClient();

const TEAM_PREFIX: Record<TeamName, string> = {
  INNOVATION: "IN",
  ENGINEERING: "EN",
  SALES: "SA",
};

async function generateUniqueRequestId(teamName: TeamName): Promise<string> {
  const prefix = TEAM_PREFIX[teamName];
  for (let attempt = 0; attempt < 50; attempt++) {
    const num = Math.floor(100000 + Math.random() * 900000);
    const requestId = `${prefix}${num}`;
    const existing = await prisma.ticket.findUnique({
      where: { requestId },
      select: { id: true },
    });
    if (!existing) return requestId;
  }
  throw new Error("Could not generate unique requestId");
}

async function main() {
  const tickets = await prisma.ticket.findMany({
    where: { requestId: null },
    select: { id: true, teamName: true },
  });
  console.log(`Found ${tickets.length} ticket(s) without requestId.`);
  for (const t of tickets) {
    const requestId = await generateUniqueRequestId(t.teamName);
    await prisma.ticket.update({
      where: { id: t.id },
      data: { requestId },
    });
    console.log(`  ${t.id} -> ${requestId}`);
  }
  console.log("Done.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
