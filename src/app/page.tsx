"use client";

import React from "react";

export default function HomePage() {
  return (
    <div className="flex-1 h-full flex flex-col items-center justify-center bg-white text-center p-8 select-none">
      <div className="w-16 h-16 rounded-full bg-[#f0f2f5] flex items-center justify-center text-[#0084ff] mb-4">
        <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
          <path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.915 1.453 5.518 3.731 7.195V22l3.39-1.861c.904.25 1.874.385 2.879.385 5.523 0 10-4.145 10-9.266C22 6.145 17.523 2 12 2zm1.066 12.464l-2.613-2.787-5.1 2.787 5.61-5.955 2.68 2.787 5.033-2.787-5.61 5.955z" />
        </svg>
      </div>
      <h3 className="text-lg font-bold text-[#050505] mb-1">Your Messages</h3>
      <p className="text-xs text-[#65676b] max-w-xs leading-relaxed">
        Send a private, end-to-end encrypted message to a contact to start chatting.
      </p>
    </div>
  );
}
