"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  className,
  id,
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      id={id}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-slate-300 transition-colors duration-150 ease-in-out focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-slate-900 border-slate-900" : "bg-slate-200",
        className
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white ring-0 transition duration-150 ease-in-out translate-y-[1px]",
          checked ? "translate-x-4" : "translate-x-0.5"
        )}
      />
    </button>
  );
}
