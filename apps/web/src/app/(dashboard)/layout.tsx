import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { userId, orgId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-muted/40 p-4">
        <h2 className="mb-6 text-lg font-semibold">DropFlow</h2>
        <nav className="flex flex-col gap-1">
          <a href="/orders" className="rounded-md px-3 py-2 text-sm hover:bg-accent">Orders</a>
          <a href="/catalog" className="rounded-md px-3 py-2 text-sm hover:bg-accent">Catalog</a>
          <a href="/shipments" className="rounded-md px-3 py-2 text-sm hover:bg-accent">Shipments</a>
          <a href="/finance" className="rounded-md px-3 py-2 text-sm hover:bg-accent">Finance</a>
          <a href="/settings" className="rounded-md px-3 py-2 text-sm hover:bg-accent">Settings</a>
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
