"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp } from "lucide-react";
import type * as React from "react";

export interface KPICardProps {
	title: string;
	value: string;
	subtitle?: string;
	trend?: number;
	icon: React.ReactNode;
	className?: string;
}

export function KPICard({
	title,
	value,
	subtitle,
	trend,
	icon,
	className,
}: KPICardProps) {
	const showTrend = trend !== undefined && !Number.isNaN(trend);
	const positive = showTrend && trend > 0;
	const negative = showTrend && trend < 0;

	return (
		<Card className={cn(className)}>
			<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
				<CardTitle className="text-sm font-medium text-muted-foreground">
					{title}
				</CardTitle>
				<div className="text-muted-foreground [&_svg]:h-4 [&_svg]:w-4">{icon}</div>
			</CardHeader>
			<CardContent>
				<div className="text-2xl font-bold tracking-tight">{value}</div>
				<div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
					{subtitle ? (
						<p className="text-xs text-muted-foreground">{subtitle}</p>
					) : null}
					{showTrend ? (
						<span
							className={cn(
								"inline-flex items-center gap-0.5 text-xs font-medium",
								positive && "text-green-600",
								negative && "text-red-600",
								!positive && !negative && "text-muted-foreground",
							)}
						>
							{positive ? (
								<TrendingUp className="h-3.5 w-3.5" aria-hidden />
							) : negative ? (
								<TrendingDown className="h-3.5 w-3.5" aria-hidden />
							) : null}
							{positive ? "+" : ""}
							{trend.toFixed(1)}%
						</span>
					) : null}
				</div>
			</CardContent>
		</Card>
	);
}
