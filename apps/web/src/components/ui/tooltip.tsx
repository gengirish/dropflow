"use client";

import { cn } from "@/lib/utils";
import { Slot } from "@radix-ui/react-slot";
import * as React from "react";

const TooltipProvider = ({ children }: { children: React.ReactNode }) => (
	<>{children}</>
);
TooltipProvider.displayName = "TooltipProvider";

const Tooltip = ({
	className,
	children,
	...props
}: React.HTMLAttributes<HTMLDivElement>) => (
	<div
		className={cn("group/tooltip relative inline-flex", className)}
		{...props}
	>
		{children}
	</div>
);
Tooltip.displayName = "Tooltip";

export interface TooltipTriggerProps extends React.HTMLAttributes<HTMLElement> {
	asChild?: boolean;
}

const TooltipTrigger = React.forwardRef<HTMLElement, TooltipTriggerProps>(
	({ className, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : "span";
		return (
			<Comp
				ref={ref as never}
				className={cn("inline-flex cursor-default", className)}
				{...props}
			/>
		);
	},
);
TooltipTrigger.displayName = "TooltipTrigger";

export interface TooltipContentProps
	extends React.HTMLAttributes<HTMLDivElement> {
	sideOffset?: number;
}

const TooltipContent = React.forwardRef<HTMLDivElement, TooltipContentProps>(
	({ className, sideOffset = 4, children, ...props }, ref) => (
		<div
			ref={ref}
			role="tooltip"
			className={cn(
				"pointer-events-none absolute z-50 max-w-xs rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md",
				"invisible opacity-0 transition-[opacity,visibility] duration-150",
				"group-hover/tooltip:visible group-hover/tooltip:opacity-100 group-focus-within/tooltip:visible group-focus-within/tooltip:opacity-100",
				"left-1/2 top-full -translate-x-1/2",
				className,
			)}
			style={{ marginTop: sideOffset }}
			{...props}
		>
			{children}
		</div>
	),
);
TooltipContent.displayName = "TooltipContent";

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
