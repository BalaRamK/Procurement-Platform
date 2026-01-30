import { prisma } from "@/lib/prisma";
import { sendNotificationEmailByType } from "@/lib/email";

export type NotificationType =
  | "on_creation"      // A: to Requester
  | "assignment"       // B: to Agent
  | "delivered"        // C: to Requester
  | "closure"          // D: to Requester
  | "team_assignment"; // E: to all Team Members

export async function logNotification(params: {
  ticketId: string;
  type: NotificationType;
  recipient: string;
  payload?: Record<string, unknown>;
}) {
  await prisma.notification.create({
    data: {
      ticketId: params.ticketId,
      type: params.type,
      recipient: params.recipient,
      payload: params.payload ? JSON.stringify(params.payload) : null,
    },
  });
  // Send email if a template exists for this trigger and recipient is an email
  if (params.recipient?.includes("@")) {
    sendNotificationEmailByType(
      params.type,
      params.recipient,
      params.ticketId,
      params.payload
    ).catch((e) => console.error("[logNotification email]", e));
  }
}
