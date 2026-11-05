import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "subtle";
  size?: "default" | "sm" | "lg" | "icon";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-xs sm:text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-900 disabled:pointer-events-none disabled:opacity-40 cursor-pointer select-none active:scale-[0.99]";

    const variants = {
      default:
        "bg-slate-900 text-white hover:bg-slate-800 border border-slate-900",
      outline:
        "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900",
      secondary:
        "bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-200",
      subtle:
        "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200",
      destructive:
        "bg-rose-600 text-white hover:bg-rose-700 border border-rose-600",
      ghost:
        "text-slate-600 hover:text-slate-900 hover:bg-slate-100",
    };

    const sizes = {
      default: "h-9 px-3.5 py-2",
      sm: "h-8 rounded-md px-2.5 text-xs",
      lg: "h-10 rounded-lg px-5 text-sm",
      icon: "h-9 w-9 p-0 rounded-lg",
    };

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
