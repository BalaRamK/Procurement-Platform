import { prisma } from "@/lib/prisma";

export type ApprovalAction = "approved" | "rejected";

export async function logApproval(params: {
  ticketId: string;
  userEmail: string;
  userId?: string | null;
  action: ApprovalAction;
  remarks?: string | null;
}) {
  await prisma.approvalLog.create({
    data: {
      ticketId: params.ticketId,
      userEmail: params.userEmail,
      userId: params.userId ?? undefined,
      action: params.action,
      remarks: params.remarks ?? undefined,
    },
  });
}
