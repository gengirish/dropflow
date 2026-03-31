"use client";

import { cn } from "@/lib/utils";
import * as React from "react";

type TabsContextValue = {
	value: string;
	onValueChange: (value: string) => void;
};

const TabsContext = React.createContext<TabsContextValue | null>(null);

function useTabsContext() {
	const ctx = React.useContext(TabsContext);
	if (!ctx) {
		throw new Error("Tabs components must be used within <Tabs>");
	}
	return ctx;
}

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
	defaultValue?: string;
	value?: string;
	onValueChange?: (value: string) => void;
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
	(
		{
			className,
			defaultValue = "",
			value: valueProp,
			onValueChange,
			children,
			...props
		},
		ref,
	) => {
		const [uncontrolled, setUncontrolled] = React.useState(defaultValue);
		const value = valueProp ?? uncontrolled;
		const handleChange = React.useCallback(
			(next: string) => {
				if (valueProp === undefined) {
					setUncontrolled(next);
				}
				onValueChange?.(next);
			},
			[valueProp, onValueChange],
		);

		const contextValue = React.useMemo(
			() => ({ value, onValueChange: handleChange }),
			[value, handleChange],
		);

		return (
			<TabsContext.Provider value={contextValue}>
				<div ref={ref} className={cn("w-full", className)} {...props}>
					{children}
				</div>
			</TabsContext.Provider>
		);
	},
);
Tabs.displayName = "Tabs";

const TabsList = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		ref={ref}
		role="tablist"
		className={cn(
			"inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
			className,
		)}
		{...props}
	/>
));
TabsList.displayName = "TabsList";

export interface TabsTriggerProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	value: string;
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
	({ className, value, ...props }, ref) => {
		const { value: selected, onValueChange } = useTabsContext();
		const isActive = selected === value;

		return (
			<button
				ref={ref}
				type="button"
				role="tab"
				aria-selected={isActive}
				data-state={isActive ? "active" : "inactive"}
				className={cn(
					"inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
					isActive
						? "bg-background text-foreground shadow-sm"
						: "hover:bg-background/50 hover:text-foreground",
					className,
				)}
				onClick={() => onValueChange(value)}
				{...props}
			/>
		);
	},
);
TabsTrigger.displayName = "TabsTrigger";

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
	value: string;
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
	({ className, value, children, ...props }, ref) => {
		const { value: selected } = useTabsContext();
		if (selected !== value) {
			return null;
		}

		return (
			<div
				ref={ref}
				role="tabpanel"
				data-state="active"
				className={cn(
					"mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
					className,
				)}
				{...props}
			>
				{children}
			</div>
		);
	},
);
TabsContent.displayName = "TabsContent";

export { Tabs, TabsContent, TabsList, TabsTrigger };
