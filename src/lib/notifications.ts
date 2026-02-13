import { query } from "@/lib/db";
import { sendNotificationEmailByType } from "@/lib/email";

export type NotificationType =
  | "on_creation"
  | "assignment"
  | "delivered"
  | "closure"
  | "team_assignment"
  | "comment_mention";

export async function logNotification(params: {
  ticketId: string;
  type: NotificationType;
  recipient: string;
  payload?: Record<string, unknown>;
}) {
  await query(
    `INSERT INTO notifications (ticket_id, type, recipient, payload)
     VALUES ($1, $2, $3, $4)`,
    [
      params.ticketId,
      params.type,
      params.recipient,
      params.payload ? JSON.stringify(params.payload) : null,
    ]
  );
  if (params.recipient?.includes("@")) {
    sendNotificationEmailByType(
      params.type,
      params.recipient,
      params.ticketId,
      params.payload
    ).catch((e) => console.error("[logNotification email]", e));
  }
}
