import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { PurchaseRequestForm } from "@/components/requests/PurchaseRequestForm";

export default async function NewRequestPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");
  if (!session.user.roles?.includes("REQUESTER") && !session.user.roles?.includes("SUPER_ADMIN")) {
    redirect("/dashboard");
  }

  const requesterName = session.user.name ?? session.user.email ?? "";
  const requesterEmail = session.user.email ?? "";
  return <PurchaseRequestForm requesterName={requesterName} requesterEmail={requesterEmail} />;
}
