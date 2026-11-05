import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const variants = {
    default: "bg-slate-900 text-white",
    success: "bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium",
    secondary: "bg-slate-100 text-slate-700 border border-slate-200",
    destructive: "bg-rose-50 text-rose-700 border border-rose-200 font-medium",
    warning: "bg-amber-50 text-amber-800 border border-amber-200 font-medium",
    outline: "border border-slate-200 text-slate-600 bg-white",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium tracking-normal transition-colors",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
