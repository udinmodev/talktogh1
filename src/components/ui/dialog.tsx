"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  className,
}: ModalProps) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden">
      {/* Modern Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Modern Responsive Dialog Card: Bottom sheet on mobile, centered card on desktop */}
      <div
        className={cn(
          "relative z-50 w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl bg-white border-t sm:border border-[#e2e8f0] p-6 text-[#111b21] shadow-2xl animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 max-h-[90vh] flex flex-col font-sans",
          className
        )}
      >
        {/* Mobile Drag Indicator Bar */}
        <div className="w-10 h-1 bg-[#cbd5e1] rounded-full mx-auto mb-3 sm:hidden" />

        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-[#667781] hover:bg-[#f1f5f9] hover:text-[#111b21] transition-colors cursor-pointer z-10"
        >
          <X className="h-5 w-5 sm:h-4 sm:w-4" />
          <span className="sr-only">Close</span>
        </button>

        {title && (
          <div className="mb-4 pr-8 shrink-0">
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-[#111b21]">
              {title}
            </h2>
            {description && (
              <p className="text-xs text-[#667781] mt-0.5 leading-relaxed">
                {description}
              </p>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto pr-1 -mr-1">{children}</div>
      </div>
    </div>
  );
}
