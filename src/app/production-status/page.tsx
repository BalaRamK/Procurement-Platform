import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { userHasProductionStatusAccess } from "@/lib/production-status-access";
import { getProductionStatusRows, todayInIndia } from "@/lib/production-status-data";
import { getProductionStatusSyncInfo } from "@/lib/production-status-sync";
import { ProductionStatusDashboard } from "@/components/production-status/ProductionStatusDashboard";

export const dynamic = "force-dynamic";

export default async function ProductionStatusPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");
  // Layouts are not re-run on every client navigation, so the page checks access itself.
  if (!(await userHasProductionStatusAccess(session.user.id, session.user.roles))) redirect("/dashboard");

  const [rows, sync] = await Promise.all([getProductionStatusRows(), getProductionStatusSyncInfo()]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary-600 dark:text-primary-300">Operations</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">Production status</h1>
      </div>
      <ProductionStatusDashboard
        rows={rows}
        todayIso={todayInIndia()}
        sync={sync ? { lastSuccessAt: sync.lastSuccessAt, lastStatus: sync.lastStatus, lastError: sync.lastError } : null}
      />
    </div>
  );
}
