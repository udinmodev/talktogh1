"use client";

import React, { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldCheck, CheckCircle2, Copy, Check, Info } from "lucide-react";

interface SafetyNumberModalProps {
  isOpen: boolean;
  onClose: () => void;
  safetyNumber: string;
  isVerified: boolean;
  onToggleVerify: (verified: boolean) => void;
  contactName: string;
}

export function SafetyNumberModal({
  isOpen,
  onClose,
  safetyNumber,
  isVerified,
  onToggleVerify,
  contactName,
}: SafetyNumberModalProps) {
  const [copied, setCopied] = useState(false);

  // Group 60-digit safety number into 4 rows of 3 blocks each
  const blocks = safetyNumber.split(" ");

  const handleCopy = () => {
    navigator.clipboard.writeText(safetyNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Verify Safety Number"
      description={`Compare this safety number with ${contactName} to confirm end-to-end encryption.`}
      className="max-w-md"
    >
      <div className="flex flex-col items-center space-y-4 pt-1 text-slate-800">
        {/* Verification Status Pill */}
        {isVerified ? (
          <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 px-3.5 py-1.5 rounded-full text-xs font-medium">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Safety Number Verified</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 bg-slate-100 text-slate-700 border border-slate-200 px-3.5 py-1.5 rounded-full text-xs font-medium">
            <ShieldCheck className="h-4 w-4 text-slate-500" />
            <span>Unverified Safety Number</span>
          </div>
        )}

        {/* QR Code Presentation */}
        <div className="relative p-5 bg-slate-50 rounded-2xl border border-slate-200/80">
          <div className="relative w-44 h-44 bg-white p-3 rounded-xl flex flex-col items-center justify-center border border-slate-200/80">
            {/* SVG QR Code */}
            <svg
              className="w-full h-full text-slate-900"
              viewBox="0 0 100 100"
              fill="currentColor"
            >
              {/* Corner Finder 1 */}
              <rect x="5" y="5" width="25" height="25" rx="3" fill="#0f172a" />
              <rect x="10" y="10" width="15" height="15" rx="1" fill="white" />
              <rect x="13" y="13" width="9" height="9" fill="#0f172a" />
              {/* Corner Finder 2 */}
              <rect x="70" y="5" width="25" height="25" rx="3" fill="#0f172a" />
              <rect x="75" y="10" width="15" height="15" rx="1" fill="white" />
              <rect x="78" y="13" width="9" height="9" fill="#0f172a" />
              {/* Corner Finder 3 */}
              <rect x="5" y="70" width="25" height="25" rx="3" fill="#0f172a" />
              <rect x="10" y="75" width="15" height="15" rx="1" fill="white" />
              <rect x="13" y="78" width="9" height="9" fill="#0f172a" />
              {/* Data dots */}
              <rect x="36" y="8" width="5" height="5" />
              <rect x="46" y="8" width="8" height="5" />
              <rect x="36" y="18" width="8" height="5" />
              <rect x="50" y="18" width="5" height="8" />
              <rect x="8" y="38" width="10" height="5" />
              <rect x="22" y="38" width="5" height="8" />
              <rect x="35" y="35" width="12" height="12" rx="2" fill="#0f172a" />
              <rect x="55" y="35" width="8" height="5" />
              <rect x="70" y="38" width="6" height="6" />
              <rect x="82" y="38" width="10" height="5" />
              <rect x="38" y="55" width="6" height="10" />
              <rect x="52" y="52" width="10" height="6" />
              <rect x="70" y="55" width="14" height="6" />
              <rect x="38" y="72" width="14" height="6" />
              <rect x="58" y="72" width="6" height="10" />
              <rect x="72" y="72" width="12" height="12" rx="2" fill="#0f172a" />
              <rect x="88" y="88" width="6" height="6" />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-white rounded-full p-2 border border-slate-200">
                <ShieldCheck className="h-5 w-5 text-slate-900" />
              </div>
            </div>
          </div>
          <span className="text-[11px] text-center block text-slate-500 mt-2 font-medium">
            Scan QR code or compare numbers
          </span>
        </div>

        {/* 60 Digits Display */}
        <div className="w-full bg-slate-50 rounded-2xl p-4 border border-slate-200/80">
          <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs sm:text-sm tracking-wider text-slate-800">
            {blocks.map((block, idx) => (
              <span
                key={idx}
                className="bg-white py-1.5 px-2 rounded-lg border border-slate-200/80"
              >
                {block}
              </span>
            ))}
          </div>

          <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-200/80">
            <span className="text-xs text-slate-400">
              Fingerprint Code
            </span>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 text-xs text-slate-900 hover:text-slate-700 font-semibold transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" /> Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" /> Copy Code
                </>
              )}
            </button>
          </div>
        </div>

        {/* Notice Card */}
        <div className="flex items-start gap-2.5 text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
          <Info className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            If the number on this screen matches the number on {contactName}&apos;s device, your connection is verified end-to-end encrypted.
          </p>
        </div>

        {/* Actions */}
        <div className="w-full flex gap-2.5 pt-2">
          <button
            className="flex-1 py-2.5 px-4 rounded-full border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            onClick={onClose}
          >
            Close
          </button>
          <button
            className={`flex-1 py-2.5 px-4 rounded-full text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2 ${
              isVerified
                ? "bg-slate-100 hover:bg-slate-200 text-slate-800"
                : "bg-slate-900 hover:bg-slate-800 text-white"
            }`}
            onClick={() => {
              onToggleVerify(!isVerified);
              onClose();
            }}
          >
            <ShieldCheck className="h-4 w-4" />
            {isVerified ? "Clear Verification" : "Mark as Verified"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
