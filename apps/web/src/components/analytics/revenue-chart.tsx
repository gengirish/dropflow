"use client";

import { formatDateIST, formatPaiseINR } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Area,
	AreaChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

export interface RevenueChartProps {
	data: Array<{
		date: string;
		revenuePaise: number;
		profitPaise: number;
		orderCount: number;
	}>;
	loading?: boolean;
}

function ChartTooltip({
	active,
	payload,
	label,
}: {
	active?: boolean;
	payload?: Array<{
		dataKey: string;
		value: number;
		color: string;
		name: string;
	}>;
	label?: string;
}) {
	if (!active || !payload?.length) return null;
	const dateLabel =
		label != null && label !== ""
			? formatDateIST(label)
			: "";
	return (
		<div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
			{dateLabel ? (
				<p className="mb-1.5 font-medium text-foreground">{dateLabel}</p>
			) : null}
			<ul className="space-y-1">
				{payload.map((entry) => (
					<li
						key={entry.dataKey}
						className="flex items-center justify-between gap-4"
					>
						<span className="flex items-center gap-2 text-muted-foreground">
							<span
								className="h-2 w-2 rounded-full"
								style={{ backgroundColor: entry.color }}
							/>
							{entry.name}
						</span>
						<span className="font-mono tabular-nums text-foreground">
							{formatPaiseINR(entry.value)}
						</span>
					</li>
				))}
			</ul>
		</div>
	);
}

export function RevenueChart({ data, loading }: RevenueChartProps) {
	if (loading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Revenue &amp; profit</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="h-[320px] w-full animate-pulse rounded-md bg-muted/60" />
				</CardContent>
			</Card>
		);
	}

	const chartData = data.map((d) => ({
		...d,
		dateKey: d.date,
	}));

	return (
		<Card>
			<CardHeader>
				<CardTitle>Revenue &amp; profit</CardTitle>
			</CardHeader>
			<CardContent>
				{chartData.length === 0 ? (
					<p className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
						No revenue data for this range.
					</p>
				) : (
					<div className="h-[320px] w-full min-w-0">
						<ResponsiveContainer width="100%" height="100%">
							<AreaChart
								data={chartData}
								margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
							>
								<defs>
									<linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
										<stop offset="0%" stopColor="rgb(37 99 235)" stopOpacity={0.35} />
										<stop offset="100%" stopColor="rgb(37 99 235)" stopOpacity={0} />
									</linearGradient>
									<linearGradient id="fillProfit" x1="0" y1="0" x2="0" y2="1">
										<stop offset="0%" stopColor="rgb(22 163 74)" stopOpacity={0.35} />
										<stop offset="100%" stopColor="rgb(22 163 74)" stopOpacity={0} />
									</linearGradient>
								</defs>
								<CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
								<XAxis
									dataKey="dateKey"
									tickLine={false}
									axisLine={false}
									tickMargin={8}
									minTickGap={24}
									tickFormatter={(v: string) => formatDateIST(v)}
									className="text-xs text-muted-foreground"
								/>
								<YAxis
									tickLine={false}
									axisLine={false}
									tickMargin={8}
									width={72}
									tickFormatter={(v: number) =>
										new Intl.NumberFormat("en-IN", {
											notation: "compact",
											compactDisplay: "short",
											maximumFractionDigits: 1,
										}).format(v / 100)
									}
									className="text-xs text-muted-foreground"
								/>
								<Tooltip content={<ChartTooltip />} />
								<Area
									type="monotone"
									dataKey="revenuePaise"
									name="Revenue"
									stroke="rgb(37 99 235)"
									fill="url(#fillRevenue)"
									strokeWidth={2}
								/>
								<Area
									type="monotone"
									dataKey="profitPaise"
									name="Profit"
									stroke="rgb(22 163 74)"
									fill="url(#fillProfit)"
									strokeWidth={2}
								/>
							</AreaChart>
						</ResponsiveContainer>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
