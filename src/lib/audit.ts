import { query } from "@/lib/db";

export type ApprovalAction = "approved" | "rejected";

export async function logApproval(params: {
  ticketId: string;
  userEmail: string;
  userId?: string | null;
  action: ApprovalAction;
  remarks?: string | null;
}) {
  await query(
    `INSERT INTO approval_logs (ticket_id, user_email, user_id, action, remarks)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      params.ticketId,
      params.userEmail,
      params.userId ?? null,
      params.action,
      params.remarks ?? null,
    ]
  );
}
