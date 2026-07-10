import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("admin tools expose a direct email settings and test option", () => {
  const adminPage = readFileSync("src/app/admin/page.tsx", "utf-8");
  const emailPage = readFileSync("src/app/admin/email-templates/page.tsx", "utf-8");
  const manager = readFileSync("src/components/admin/EmailTemplateManagerView.tsx", "utf-8");

  assert.ok(adminPage.includes('/admin/email-templates?tab=delivery'));
  assert.ok(adminPage.includes("Email settings & test"));
  assert.ok(emailPage.includes("initialTab"));
  assert.ok(manager.includes("initialTab"));
  assert.ok(manager.includes("Send test email"));
  assert.ok(manager.includes("/api/admin/email-test"));
});
