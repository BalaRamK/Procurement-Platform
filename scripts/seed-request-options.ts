/**
 * Seed default project/customer names and charge codes (run after db:init or migrate-request-options).
 * Usage: npx tsx scripts/seed-request-options.ts
 */
import { config } from "dotenv";
import { Pool } from "pg";

config({ path: ".env" });
config({ path: ".env.local" });

const PROJECT_NAMES = [
  "Chip QKD", "CR QRNG", "CV QKD", "Digital QKD", "Free Space QKD", "MCarp", "NQM", "Optical QRNG",
  "PCie QRNG", "PQC Algorithm", "PQC Chip - Drone", "PQC Chip - IoT", "QHSM", "QKDN", "QRNG New Tech",
  "QRNG SIP", "QSen GPS Nav", "QSen Gravimeter", "QSen Magnetometer", "QShield Platform", "QShield QConnect",
  "QShield Qosmos", "QShield QSFS", "QShield QVault", "QShield QVerse", "QShield RAC", "SPD", "Terrestrial QKD",
  "Testing", "Tropos Lite", "TTDF",
];

const CHARGE_CODES: { code: string; team: string }[] = [
  { code: "QN_INOV_CAPX_PD", team: "INNOVATION" },
  { code: "QN_INOV_CAPX_R&D", team: "INNOVATION" },
  { code: "QN_EN_CAPX_PD", team: "ENGINEERING" },
  { code: "QN_EN_CAPX_R&D", team: "ENGINEERING" },
  { code: "QN_DL_INV", team: "SALES" },
];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  const pool = new Pool({ connectionString });

  for (let i = 0; i < PROJECT_NAMES.length; i++) {
    await pool.query(
      `INSERT INTO project_customer_options (name, sort_order) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING`,
      [PROJECT_NAMES[i], i]
    );
  }
  console.log("Seeded project/customer options:", PROJECT_NAMES.length);

  for (let i = 0; i < CHARGE_CODES.length; i++) {
    await pool.query(
      `INSERT INTO charge_code_options (code, team_name, sort_order) VALUES ($1, $2, $3) ON CONFLICT (code, team_name) DO NOTHING`,
      [CHARGE_CODES[i].code, CHARGE_CODES[i].team, i]
    );
  }
  console.log("Seeded charge code options:", CHARGE_CODES.length);

  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
