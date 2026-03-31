import { Separator } from "@/components/ui/separator";
import { auth } from "@clerk/nextjs/server";
import {
	BarChart3,
	IndianRupee,
	Package,
	Settings,
	ShoppingCart,
	Truck,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

const navClassName =
	"flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground";

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const { userId } = await auth();

	if (!userId) {
		redirect("/sign-in");
	}

	return (
		<div className="flex min-h-screen">
			<aside className="w-64 border-r bg-muted/40 p-4">
				<h2 className="mb-6 text-lg font-semibold">DropFlow</h2>
				<nav className="flex flex-col gap-1">
					<Link href="/orders" className={navClassName}>
						<ShoppingCart className="h-4 w-4 shrink-0" aria-hidden />
						Orders
					</Link>
					<Link href="/catalog" className={navClassName}>
						<Package className="h-4 w-4 shrink-0" aria-hidden />
						Catalog
					</Link>
					<Link href="/shipments" className={navClassName}>
						<Truck className="h-4 w-4 shrink-0" aria-hidden />
						Shipments
					</Link>
					<Link href="/finance" className={navClassName}>
						<IndianRupee className="h-4 w-4 shrink-0" aria-hidden />
						Finance
					</Link>
					<Link href="/analytics" className={navClassName}>
						<BarChart3 className="h-4 w-4 shrink-0" aria-hidden />
						Analytics
					</Link>
					<Separator className="my-2" />
					<Link href="/settings" className={navClassName}>
						<Settings className="h-4 w-4 shrink-0" aria-hidden />
						Settings
					</Link>
				</nav>
			</aside>
			<main className="flex-1 p-6">{children}</main>
		</div>
	);
}
