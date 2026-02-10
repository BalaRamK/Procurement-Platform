import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { RequestOptionsManager } from "@/components/admin/RequestOptionsManager";

export default async function AdminRequestOptionsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");
  if (!session.user.roles?.includes("SUPER_ADMIN")) redirect("/dashboard");

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white">
          ← Back to User management
        </Link>
      </div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Products & charge codes</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-200">
          Manage project/customer names and charge codes that appear in the New request form dropdowns.
        </p>
      </div>
      <RequestOptionsManager />
    </div>
  );
}
