import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { query, queryOne } from "@/lib/db";
import type { TeamName } from "@/types/db";
import { TEAM_NAMES } from "@/types/db";
import { z } from "zod";

const addProjectSchema = z.object({ name: z.string().trim().min(1).max(200) });
const addChargeCodeSchema = z.object({
  code: z.string().trim().min(1).max(100),
  teamName: z.enum(TEAM_NAMES),
});

/** GET: full list with ids for admin page (super admin only) */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.roles?.includes("SUPER_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const [projects, chargeCodes] = await Promise.all([
      query<{ id: string; name: string; sortOrder: number }>(
        "SELECT id, name, sort_order AS \"sortOrder\" FROM project_customer_options ORDER BY sort_order, name"
      ),
      query<{ id: string; code: string; teamName: TeamName; sortOrder: number }>(
        "SELECT id, code, team_name AS \"teamName\", sort_order AS \"sortOrder\" FROM charge_code_options ORDER BY team_name, sort_order, code"
      ),
    ]);
    return NextResponse.json({ projects, chargeCodes });
  } catch (e) {
    console.error("admin request-options GET", e);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}

/** POST: add project name or charge code (super admin only) */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !session.user.roles?.includes("SUPER_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const type = body?.type;

  if (type === "project") {
    const parsed = addProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
    }
    try {
      const maxOrder = await queryOne<{ max: number }>(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 AS max FROM project_customer_options"
      );
      await query(
        "INSERT INTO project_customer_options (name, sort_order) VALUES ($1, $2)",
        [parsed.data.name, maxOrder?.max ?? 0]
      );
      const row = await queryOne<{ id: string; name: string }>(
        "SELECT id, name FROM project_customer_options WHERE name = $1",
        [parsed.data.name]
      );
      return NextResponse.json(row);
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "code" in e && (e as { code: string }).code === "23505"
        ? "Name already exists"
        : "Failed to add";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  if (type === "charge_code") {
    const parsed = addChargeCodeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid body", details: parsed.error.flatten() }, { status: 400 });
    }
    try {
      const maxOrder = await queryOne<{ max: number }>(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 AS max FROM charge_code_options WHERE team_name = $1",
        [parsed.data.teamName]
      );
      await query(
        "INSERT INTO charge_code_options (code, team_name, sort_order) VALUES ($1, $2, $3)",
        [parsed.data.code, parsed.data.teamName, maxOrder?.max ?? 0]
      );
      const row = await queryOne<{ id: string; code: string; teamName: string }>(
        "SELECT id, code, team_name AS \"teamName\" FROM charge_code_options WHERE code = $1 AND team_name = $2",
        [parsed.data.code, parsed.data.teamName]
      );
      return NextResponse.json(row);
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "code" in e && (e as { code: string }).code === "23505"
        ? "Code already exists for this team"
        : "Failed to add";
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "Invalid body: type must be 'project' or 'charge_code'" }, { status: 400 });
}
