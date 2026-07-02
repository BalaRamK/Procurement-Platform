import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { InventorySearchClient } from "@/components/inventory/InventorySearchClient";

export default async function InventorySearchPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth/signin");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Search Inventory</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-200">
          Read-only Zoho inventory checks for single items and bulk Excel lists.
        </p>
      </div>
      <InventorySearchClient />
    </div>
  );
}
