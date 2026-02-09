import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { EmailTemplateManager } from "@/components/admin/EmailTemplateManager";

export default async function AdminEmailTemplatesPage() {
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
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Email templates</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-200">
          Add or edit auto email templates and set when they are sent (immediate, 24h, 48h, or custom delay).
        </p>
      </div>
      <EmailTemplateManager />
    </div>
  );
}
