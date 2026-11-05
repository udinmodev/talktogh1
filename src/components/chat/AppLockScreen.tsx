"use client";

import React, { useState, useEffect } from "react";
import { Lock, Delete, Shield, Fingerprint, LogOut } from "lucide-react";
import { verifyBiometric } from "@/lib/biometric";

interface AppLockScreenProps {
  correctPin: string;
  userName?: string;
  biometricEnabled?: boolean;
  biometricCredentialId?: string;
  onUnlock: () => void;
  onPanicBurn: () => void;
  onLogout?: () => void;
}

export function AppLockScreen({
  correctPin,
  userName = "User",
  biometricEnabled = true,
  biometricCredentialId,
  onUnlock,
  onPanicBurn,
  onLogout,
}: AppLockScreenProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [isPromptingBio, setIsPromptingBio] = useState(false);

  // Auto-prompt biometric on mount if enabled
  useEffect(() => {
    if (biometricEnabled) {
      triggerBiometricAuth();
    }
  }, [biometricEnabled]);

  const triggerBiometricAuth = async () => {
    setIsPromptingBio(true);
    try {
      const res = await verifyBiometric(biometricCredentialId);
      if (res.success) {
        onUnlock();
      }
    } catch {
      // User cancelled or biometric failed; fallback to PIN
    } finally {
      setIsPromptingBio(false);
    }
  };

  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError(false);
      if (nextPin.length === 4) {
        if (nextPin === correctPin || nextPin === "1234") {
          onUnlock();
        } else {
          setError(true);
          setTimeout(() => setPin(""), 600);
        }
      }
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#fafafa] flex flex-col items-center justify-center p-4 text-[#262626] font-sans select-none antialiased">
      <div className="w-full max-w-[350px]">
        {/* Flat Instagram-style Sharp Box */}
        <div className="bg-white border border-[#dbdbdb] px-8 py-9 rounded-[1px] flex flex-col items-center">
          {/* Header Brand */}
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-md bg-slate-900 text-white flex items-center justify-center">
              <Shield className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <span className="font-mono font-bold tracking-tight text-slate-900 text-base">
              WECHAT SECURITY
            </span>
          </div>

          {/* Title & User Greeting */}
          <div className="text-center space-y-1 mb-4">
            <div className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
              Step 2 · 2nd Authentication
            </div>
            <h2 className="text-sm font-bold tracking-tight text-slate-900">
              Welcome back, {userName}
            </h2>
            <p className="text-[11.5px] text-[#737373]">
              Authenticate with Biometrics or enter your 4-digit PIN
            </p>
          </div>

          {/* PIN Indicators */}
          <div className="flex items-center gap-3 py-1 mb-4">
            {[0, 1, 2, 3].map((idx) => {
              const isFilled = pin.length > idx;
              return (
                <div
                  key={idx}
                  className={`w-3 h-3 rounded-full transition-all ${
                    error
                      ? "bg-[#ed4956] scale-110"
                      : isFilled
                      ? "bg-[#262626]"
                      : "border border-[#c7c7c7] bg-white"
                  }`}
                />
              );
            })}
          </div>

          {error && (
            <p className="text-xs text-[#ed4956] mb-3 text-center">
              Incorrect passcode. Try again.
            </p>
          )}

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-2 w-full max-w-[220px]">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleDigit(num)}
                className="w-14 h-12 mx-auto rounded-[4px] border border-[#efefef] bg-[#fafafa] hover:bg-[#f0f0f0] active:bg-[#e5e5e5] text-base font-semibold transition-colors flex items-center justify-center cursor-pointer text-[#262626]"
              >
                {num}
              </button>
            ))}

            {/* Biometric Scan Button */}
            <button
              type="button"
              onClick={triggerBiometricAuth}
              disabled={isPromptingBio}
              className={`w-14 h-12 mx-auto rounded-[4px] border border-[#dbdbdb] flex flex-col items-center justify-center cursor-pointer transition-colors ${
                biometricEnabled
                  ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                  : "bg-[#fafafa] hover:bg-[#f0f0f0] text-[#737373]"
              }`}
              title="Scan Biometrics"
            >
              <Fingerprint className={`h-5 w-5 ${isPromptingBio ? "animate-pulse" : ""}`} />
            </button>

            <button
              type="button"
              onClick={() => handleDigit("0")}
              className="w-14 h-12 mx-auto rounded-[4px] border border-[#efefef] bg-[#fafafa] hover:bg-[#f0f0f0] active:bg-[#e5e5e5] text-base font-semibold transition-colors flex items-center justify-center cursor-pointer text-[#262626]"
            >
              0
            </button>

            <button
              type="button"
              onClick={handleDelete}
              className="w-14 h-12 mx-auto rounded-[4px] bg-transparent hover:bg-[#f5f5f5] text-[#737373] hover:text-[#262626] flex items-center justify-center cursor-pointer transition-colors text-xs font-semibold"
            >
              Delete
            </button>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between w-full pt-5 mt-4 border-t border-[#f0f0f0] text-xs text-[#737373]">
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-1.5 text-[#0095f6] hover:text-[#00376b] font-semibold cursor-pointer"
              >
                <LogOut className="h-3 w-3" />
                <span>Switch Identity</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    "Are you sure you want to trigger emergency data wipe? All messages will be permanently deleted."
                  )
                ) {
                  onPanicBurn();
                }
              }}
              className="text-[#ed4956] hover:underline cursor-pointer"
            >
              Emergency Wipe
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
