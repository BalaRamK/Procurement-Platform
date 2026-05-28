import assert from "node:assert/strict";
import test from "node:test";
import { config } from "dotenv";
import { Pool } from "pg";
import { DEFAULT_EMAIL_TEMPLATES } from "../src/lib/email-template-catalog";

config({ path: ".env" });
config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;

type Role =
  | "SUPER_ADMIN"
  | "REQUESTER"
  | "FUNCTIONAL_HEAD"
  | "L1_APPROVER"
  | "CFO"
  | "CDO"
  | "PRODUCTION";

type SmokeUser = {
  id: string;
  email: string;
  role: Role;
};

const templateByTrigger = new Map(DEFAULT_EMAIL_TEMPLATES.map((template) => [template.trigger, template]));

async function assertTemplate(trigger: string) {
  const template = templateByTrigger.get(trigger);
  assert.ok(template, `Missing default email template for ${trigger}`);
  assert.equal(template.extraRecipients ?? null, null);
  assert.ok(template.bodyTemplate.includes("Procurement Platform"));
  return template;
}

test("local procurement lifecycle and email triggers work end to end", { skip: !DATABASE_URL }, async () => {
  const pool = new Pool({ connectionString: DATABASE_URL });
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const domain = "smoke.local";
  const ticketIds: string[] = [];
  const userIds: string[] = [];

  async function createUser(role: Role, team: string | null = "ENGINEERING"): Promise<SmokeUser> {
    const email = `${role.toLowerCase().replace(/_/g, "-")}-${suffix}@${domain}`;
    const result = await pool.query<{ id: string; email: string }>(
      `INSERT INTO users (email, profile_name, name, roles, team, status)
       VALUES ($1, $2, $3, ARRAY[$4]::"UserRole"[], $5::"TeamName", true)
       RETURNING id, email`,
      [email, `Smoke ${role}`, `Smoke ${role}`, role, team]
    );
    userIds.push(result.rows[0].id);
    return { ...result.rows[0], role };
  }

  async function recordNotification(ticketId: string, type: string, recipient: string, trigger: string, currentStage: string, nextStage: string) {
    await assertTemplate(trigger);
    await pool.query(
      `INSERT INTO notifications (ticket_id, type, recipient, payload)
       VALUES ($1, $2, $3, $4)`,
      [
        ticketId,
        type,
        recipient,
        JSON.stringify({ currentStage, nextStage, emailTrigger: trigger }),
      ]
    );
  }

  try {
    const enumRows = await pool.query<{ enumlabel: string }>(
      `SELECT enumlabel
       FROM pg_enum e
       JOIN pg_type t ON t.oid = e.enumtypid
       WHERE t.typname = 'TicketStatus'
       ORDER BY e.enumsortorder`
    );
    assert.ok(enumRows.rows.some((row) => row.enumlabel === "ORDER_PLACED"), "Database enum is missing ORDER_PLACED");

    const requiredColumns = ["brand_name_company", "preferred_supplier", "country_of_origin"];
    const columnRows = await pool.query<{ column_name: string }>(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_name = 'tickets'
         AND column_name = ANY($1)
       ORDER BY column_name`,
      [requiredColumns]
    );
    assert.deepEqual(
      columnRows.rows.map((row) => row.column_name),
      [...requiredColumns].sort(),
      "Database is missing one or more ticket detail columns"
    );

    const requester = await createUser("REQUESTER");
    const l1 = await createUser("L1_APPROVER");
    const functionalHead = await createUser("FUNCTIONAL_HEAD");
    const cfo = await createUser("CFO", null);
    const cdo = await createUser("CDO", null);
    const procurement = await createUser("PRODUCTION", null);
    await createUser("SUPER_ADMIN", null);

    const assignees = await pool.query<{ role: Role; email: string }>(
      `SELECT roles[1]::text AS role, email
       FROM users
       WHERE email LIKE $1
       ORDER BY email`,
      [`%-${suffix}@${domain}`]
    );
    assert.equal(assignees.rowCount, 7);

    const ticketResult = await pool.query<{ id: string }>(
      `INSERT INTO tickets (
         request_id, title, description, requester_name, department,
         component_description, item_name, brand_name_company, preferred_supplier, country_of_origin,
         need_by_date, team_name, priority, status, requester_id
       )
       VALUES ($1, 'Smoke procurement flow', 'Smoke request for flow validation', 'Smoke Requester', 'QA',
         'Smoke component', 'Smoke item', 'Smoke brand', 'Smoke supplier', 'India',
         CURRENT_DATE + INTERVAL '7 days', 'ENGINEERING', 'MEDIUM', 'DRAFT', $2)
       RETURNING id`,
      [`SMOKE-${suffix}`, requester.id]
    );
    const ticketId = ticketResult.rows[0].id;
    ticketIds.push(ticketId);

    await recordNotification(ticketId, "on_creation", requester.email, "request_created", "Draft", "Draft");

    await pool.query("UPDATE tickets SET status = 'PENDING_L1_APPROVAL', updated_at = now() WHERE id = $1", [ticketId]);
    await recordNotification(ticketId, "assignment", l1.email, "request_submitted_to_l1", "Draft", "Pending L1 Approval");

    await pool.query("UPDATE tickets SET status = 'PENDING_FH_APPROVAL', updated_at = now() WHERE id = $1", [ticketId]);
    await recordNotification(ticketId, "assignment", functionalHead.email, "l1_approved_moved_to_fh", "Pending L1 Approval", "Pending Department Head Approval");

    await pool.query("UPDATE tickets SET status = 'PENDING_CFO_APPROVAL', updated_at = now() WHERE id = $1", [ticketId]);
    await recordNotification(ticketId, "assignment", cfo.email, "fh_approved_moved_to_cfo", "Pending Department Head Approval", "Pending CFO Approval");

    await pool.query("UPDATE tickets SET status = 'PENDING_CDO_APPROVAL', updated_at = now() WHERE id = $1", [ticketId]);
    await recordNotification(ticketId, "assignment", cdo.email, "cfo_approved_moved_to_cdo", "Pending CFO Approval", "Pending CDO Approval");

    await pool.query("UPDATE tickets SET status = 'ASSIGNED_TO_PRODUCTION', updated_at = now() WHERE id = $1", [ticketId]);
    await recordNotification(ticketId, "team_assignment", procurement.email, "cdo_approved_moved_to_production", "Pending CDO Approval", "Assigned to Production");

    await pool.query("UPDATE tickets SET status = 'ORDER_PLACED', updated_at = now() WHERE id = $1", [ticketId]);
    await recordNotification(ticketId, "order_placed", requester.email, "production_marked_order_placed", "Assigned to Production", "Order Placed");

    await pool.query("UPDATE tickets SET status = 'DELIVERED_TO_REQUESTER', delivered_at = now(), updated_at = now() WHERE id = $1", [ticketId]);
    await recordNotification(ticketId, "delivered", requester.email, "production_marked_delivered", "Order Placed", "Delivered to Requester");

    await pool.query("UPDATE tickets SET status = 'CLOSED', confirmed_at = now(), auto_closed_at = now(), updated_at = now() WHERE id = $1", [ticketId]);
    await recordNotification(ticketId, "closure", requester.email, "requester_confirmed_receipt", "Delivered to Requester", "Closed");

    const finalTicket = await pool.query<{ status: string }>("SELECT status FROM tickets WHERE id = $1", [ticketId]);
    assert.equal(finalTicket.rows[0].status, "CLOSED");

    const notificationRows = await pool.query<{ type: string; recipient: string; trigger: string }>(
      `SELECT type, recipient, payload::json->>'emailTrigger' AS trigger
       FROM notifications
       WHERE ticket_id = $1
       ORDER BY sent_at ASC`,
      [ticketId]
    );
    assert.deepEqual(
      notificationRows.rows.map((row) => row.trigger),
      [
        "request_created",
        "request_submitted_to_l1",
        "l1_approved_moved_to_fh",
        "fh_approved_moved_to_cfo",
        "cfo_approved_moved_to_cdo",
        "cdo_approved_moved_to_production",
        "production_marked_order_placed",
        "production_marked_delivered",
        "requester_confirmed_receipt",
      ]
    );
  } finally {
    for (const ticketId of ticketIds) {
      await pool.query("DELETE FROM notifications WHERE ticket_id = $1", [ticketId]);
      await pool.query("DELETE FROM approval_logs WHERE ticket_id = $1", [ticketId]);
      await pool.query("DELETE FROM ticket_line_items WHERE ticket_id = $1", [ticketId]);
      await pool.query("DELETE FROM tickets WHERE id = $1", [ticketId]);
    }
    if (userIds.length > 0) {
      await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [userIds]);
    }
    await pool.end();
  }
});
