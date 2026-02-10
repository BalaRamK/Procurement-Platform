import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import type { TeamName } from "@/types/db";
import { TEAM_NAMES } from "@/types/db";

type ProjectRow = { name: string };
type ChargeRow = { code: string; teamName: TeamName };

/** GET: returns project names and charge codes by team for New request form dropdowns */
export async function GET() {
  try {
    const [projectRows, chargeRows] = await Promise.all([
      query<ProjectRow>("SELECT name FROM project_customer_options ORDER BY sort_order, name"),
      query<ChargeRow>("SELECT code, team_name AS \"teamName\" FROM charge_code_options ORDER BY team_name, sort_order, code"),
    ]);

    const projectNames = projectRows.map((r) => r.name);
    const chargeCodesByTeam: Record<TeamName, string[]> = {
      INNOVATION: [],
      ENGINEERING: [],
      SALES: [],
    };
    for (const r of chargeRows) {
      if (TEAM_NAMES.includes(r.teamName)) {
        chargeCodesByTeam[r.teamName].push(r.code);
      }
    }

    return NextResponse.json({ projectNames, chargeCodesByTeam });
  } catch (e) {
    console.error("request-options GET", e);
    return NextResponse.json(
      { error: "Failed to load options", projectNames: [], chargeCodesByTeam: { INNOVATION: [], ENGINEERING: [], SALES: [] } },
      { status: 500 }
    );
  }
}
