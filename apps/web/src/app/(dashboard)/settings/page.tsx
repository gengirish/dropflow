import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Building2, Plug, Workflow } from "lucide-react";
import Link from "next/link";

const sections = [
	{
		title: "Workflows",
		description:
			"Design order automation DAGs with a visual editor and manage versions.",
		href: "/settings/workflows",
		icon: Workflow,
		available: true,
	},
	{
		title: "Business Settings",
		description: "Company profile, tax defaults, and operational preferences.",
		href: "#",
		icon: Building2,
		available: false,
	},
	{
		title: "Integrations",
		description: "Carriers, payments, and third-party connections.",
		href: "#",
		icon: Plug,
		available: false,
	},
];

export default function SettingsPage() {
	return (
		<div className="space-y-8">
			<div>
				<h1 className="text-2xl font-bold tracking-tight">Settings</h1>
				<p className="mt-2 text-muted-foreground">
					Configure how DropFlow runs your tenant — workflows, business rules,
					and integrations.
				</p>
			</div>
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{sections.map((s) =>
					s.available ? (
						<Link
							key={s.title}
							href={s.href}
							className="block h-full outline-none"
						>
							<Card className="h-full transition-colors hover:border-primary/40 hover:shadow-md">
								<CardHeader className="flex flex-row items-start gap-4 space-y-0">
									<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
										<s.icon className="h-5 w-5" aria-hidden />
									</div>
									<div className="min-w-0 flex-1 space-y-1">
										<CardTitle className="text-lg">{s.title}</CardTitle>
										<CardDescription className="text-pretty">
											{s.description}
										</CardDescription>
									</div>
								</CardHeader>
							</Card>
						</Link>
					) : (
						<div key={s.title} className="h-full cursor-not-allowed">
							<Card className="h-full opacity-70">
								<CardHeader className="flex flex-row items-start gap-4 space-y-0">
									<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
										<s.icon className="h-5 w-5" aria-hidden />
									</div>
									<div className="min-w-0 flex-1 space-y-1">
										<CardTitle className="text-lg">{s.title}</CardTitle>
										<CardDescription className="text-pretty">
											{s.description}
										</CardDescription>
										<p className="pt-1 text-xs font-medium text-muted-foreground">
											Coming soon
										</p>
									</div>
								</CardHeader>
							</Card>
						</div>
					),
				)}
			</div>
		</div>
	);
}
