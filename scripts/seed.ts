/**
 * Seed the database with sample users and tickets.
 * Usage: npm run db:seed (or npx tsx scripts/seed.ts)
 */
import { config } from "dotenv";
import { Pool } from "pg";
import { query, queryOne } from "../src/lib/db";

config({ path: ".env" });
config({ path: ".env.local" });

async function main() {
  const countResult = await queryOne<{ count: string }>("SELECT COUNT(*) AS count FROM users");
  const existingUsers = parseInt(countResult?.count ?? "0", 10);
  if (existingUsers > 0) {
    console.log("Database already has users. Skipping seed.");
    return;
  }

  const superAdmin = await queryOne<{ id: string }>(
    `INSERT INTO users (email, profile_name, name, roles, status) VALUES ('admin@qnulabs.com', 'Default', 'Super Admin', ARRAY['SUPER_ADMIN']::"UserRole"[], true) RETURNING id`
  );
  if (!superAdmin) throw new Error("Failed to create super admin");

  const requester = await queryOne<{ id: string }>(
    `INSERT INTO users (email, profile_name, name, roles, status) VALUES ('requester@qnulabs.com', 'Default', 'Jane Requester', ARRAY['REQUESTER']::"UserRole"[], true) RETURNING id`
  );
  if (!requester) throw new Error("Failed to create requester");

  await query(
    `INSERT INTO users (email, profile_name, name, roles, team, status) VALUES 
     ('fh-innovation@qnulabs.com', 'Default', 'FH Innovation', ARRAY['FUNCTIONAL_HEAD']::"UserRole"[], 'INNOVATION', true),
     ('fh-engineering@qnulabs.com', 'Default', 'FH Engineering', ARRAY['FUNCTIONAL_HEAD']::"UserRole"[], 'ENGINEERING', true),
     ('l1-sales@qnulabs.com', 'Default', 'L1 Sales (Prem)', ARRAY['L1_APPROVER']::"UserRole"[], 'SALES', true),
     ('l1-innovation@qnulabs.com', 'Default', 'L1 Innovation (Dilip)', ARRAY['L1_APPROVER']::"UserRole"[], 'INNOVATION', true),
     ('l1-engineering@qnulabs.com', 'Default', 'L1 Engineering (Dilip)', ARRAY['L1_APPROVER']::"UserRole"[], 'ENGINEERING', true),
     ('cfo@qnulabs.com', 'Default', 'CFO', ARRAY['CFO']::"UserRole"[], null, true),
     ('cdo@qnulabs.com', 'Default', 'CDO', ARRAY['CDO']::"UserRole"[], null, true),
     ('production@qnulabs.com', 'Default', 'Production Team', ARRAY['PRODUCTION']::"UserRole"[], null, true)`
  );

  await query(
    `INSERT INTO tickets (title, description, requester_name, department, component_description, item_name, rate, unit, quantity, estimated_cost, cost_currency, team_name, priority, status, requester_id) VALUES
     ('Laptop - Dev team Q1', '5 units for new joiners.', 'Jane Requester', 'Engineering', 'Dell XPS 15', 'Laptop Dell XPS 15', 1299.99, 'pcs', 5, 6499.95, 'USD', 'ENGINEERING', 'HIGH', 'PENDING_FH_APPROVAL', $1),
     ('Office chairs - Floor 2', 'Ergonomic chairs for meeting room.', 'Jane Requester', 'Facilities', null, 'Ergonomic Office Chair', 349.5, 'pcs', 10, 3495, 'USD', 'ENGINEERING', 'MEDIUM', 'DRAFT', $1),
     ('Server rack components', 'Rack rails and cable management.', 'Jane Requester', 'IT', 'Server Rack Kit', 'Server Rack Kit', 899, 'set', 2, 1798, 'USD', 'INNOVATION', 'HIGH', 'ASSIGNED_TO_PRODUCTION', $1),
     ('Cloud subscription - Annual', 'AWS and Zoho annual renewal.', 'Jane Requester', 'IT', null, null, null, null, 1, 12000, 'USD', 'SALES', 'MEDIUM', 'PENDING_CFO_APPROVAL', $1),
     ('Training materials', 'Printed manuals for onboarding.', 'Jane Requester', 'HR', null, 'Training Pack', 45, 'pcs', 50, 2250, 'USD', 'ENGINEERING', 'LOW', 'REJECTED', $1)`,
    [requester.id]
  );

  await query(
    `UPDATE tickets SET rejection_remarks = 'Budget not approved for this quarter.' WHERE status = 'REJECTED' AND requester_id = $1`,
    [requester.id]
  );

  console.log("Seed completed: 10 users, 5 sample tickets.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
