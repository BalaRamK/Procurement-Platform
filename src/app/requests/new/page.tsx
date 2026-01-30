import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { PurchaseRequestForm } from "@/components/requests/PurchaseRequestForm";

export default async function NewRequestPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");
  if (session.user.role !== "REQUESTER" && session.user.role !== "SUPER_ADMIN") {
    redirect("/dashboard");
  }

  const requesterName = session.user.name ?? session.user.email ?? "";
  const requesterEmail = session.user.email ?? "";
  return <PurchaseRequestForm requesterName={requesterName} requesterEmail={requesterEmail} />;
}
