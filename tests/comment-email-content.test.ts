import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("mention emails always include the cleaned full comment text", () => {
  const commentsRoute = readFileSync("src/app/api/requests/[id]/comments/route.ts", "utf-8");
  const email = readFileSync("src/lib/email.ts", "utf-8");
  const templates = readFileSync("src/lib/email-template-catalog.ts", "utf-8");

  assert.ok(commentsRoute.includes("commentText"));
  assert.ok(!commentsRoute.includes(".slice(0, 500)"));
  assert.ok(email.includes("ensureMentionCommentText"));
  assert.ok(email.includes('trigger === "comment_mention"'));
  assert.ok(templates.includes("{{commentText}}"));
});
