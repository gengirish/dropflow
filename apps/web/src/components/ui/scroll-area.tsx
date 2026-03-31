import { cn } from "@/lib/utils";
import * as React from "react";

const ScrollArea = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
	<div
		ref={ref}
		className={cn(
			"relative overflow-auto",
			"[scrollbar-width:thin]",
			"[scrollbar-color:hsl(var(--border))_transparent]",
			"[&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2",
			"[&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border",
			"[&::-webkit-scrollbar-track]:bg-transparent",
			className,
		)}
		{...props}
	>
		{children}
	</div>
));
ScrollArea.displayName = "ScrollArea";

export interface ScrollBarProps extends React.HTMLAttributes<HTMLDivElement> {
	orientation?: "vertical" | "horizontal";
}

/**
 * Native scrollbars are styled on `ScrollArea`. This is a no-op for API parity with Radix scroll area.
 */
const ScrollBar = React.forwardRef<HTMLDivElement, ScrollBarProps>(
	({ className, orientation: _orientation, ...props }, ref) => (
		<div ref={ref} className={cn("hidden", className)} aria-hidden {...props} />
	),
);
ScrollBar.displayName = "ScrollBar";

export { ScrollArea, ScrollBar };
