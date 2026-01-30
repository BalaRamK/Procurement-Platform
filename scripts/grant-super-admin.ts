/**
 * One-off script: grant SUPER_ADMIN role to a user by email.
 * Usage: npx tsx scripts/grant-super-admin.ts
 * Requires DATABASE_URL in .env (from project root)
 */
import { config } from "dotenv";
config({ path: ".env" });
config({ path: ".env.local" });
import { PrismaClient } from "@prisma/client";

const EMAIL = "bala.k@qnulabs.com";

async function main() {
  const prisma = new PrismaClient();
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { role: "SUPER_ADMIN" },
    create: {
      email: EMAIL,
      name: "Bala K",
      role: "SUPER_ADMIN",
      status: true,
    },
  });
  console.log("Granted SUPER_ADMIN to:", user.email);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
