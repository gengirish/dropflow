import { Separator } from "@/components/ui/separator";
import { auth } from "@clerk/nextjs/server";
import {
	BarChart3,
	Bell,
	GitCompareArrows,
	IndianRupee,
	Layers,
	MapPin,
	Package,
	RefreshCw,
	RotateCcw,
	Settings,
	ShieldAlert,
	ShoppingCart,
	Star,
	TrendingDown,
	Truck,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

const navClassName =
	"flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground";
const subNavClassName = `${navClassName} pl-9 text-muted-foreground`;

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
					<Link href="/catalog/suppliers/scorecards" className={subNavClassName}>
						<Star className="h-4 w-4 shrink-0" aria-hidden />
						Supplier Scorecards
					</Link>
					<Link href="/channels" className={navClassName}>
						<Layers className="h-4 w-4 shrink-0" aria-hidden />
						Channels
					</Link>
					<Link href="/inventory/reorder" className={navClassName}>
						<RefreshCw className="h-4 w-4 shrink-0" aria-hidden />
						Reorder
					</Link>
					<Link href="/shipments" className={navClassName}>
						<Truck className="h-4 w-4 shrink-0" aria-hidden />
						Shipments
					</Link>
					<Link href="/shipments/pincode" className={subNavClassName}>
						<MapPin className="h-4 w-4 shrink-0" aria-hidden />
						Pincode &amp; Rates
					</Link>
					<Link href="/returns" className={navClassName}>
						<RotateCcw className="h-4 w-4 shrink-0" aria-hidden />
						Returns
					</Link>
					<Link href="/finance" className={navClassName}>
						<IndianRupee className="h-4 w-4 shrink-0" aria-hidden />
						Finance
					</Link>
					<Link href="/finance/margins" className={subNavClassName}>
						<TrendingDown className="h-4 w-4 shrink-0" aria-hidden />
						Margin Waterfall
					</Link>
					<Link href="/finance/reconciliation" className={subNavClassName}>
						<GitCompareArrows className="h-4 w-4 shrink-0" aria-hidden />
						Reconciliation
					</Link>
					<Link href="/analytics" className={navClassName}>
						<BarChart3 className="h-4 w-4 shrink-0" aria-hidden />
						Analytics
					</Link>
					<Link href="/analytics/rto" className={subNavClassName}>
						<ShieldAlert className="h-4 w-4 shrink-0" aria-hidden />
						RTO Prediction
					</Link>
					<Separator className="my-2" />
					<Link href="/settings" className={navClassName}>
						<Settings className="h-4 w-4 shrink-0" aria-hidden />
						Settings
					</Link>
					<Link href="/settings/notifications" className={subNavClassName}>
						<Bell className="h-4 w-4 shrink-0" aria-hidden />
						Notifications
					</Link>
				</nav>
			</aside>
			<main className="flex-1 p-6">{children}</main>
		</div>
	);
}
