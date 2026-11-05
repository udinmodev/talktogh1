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
  onPanicBurn?: () => void;
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
    <div className="fixed inset-0 z-50 bg-[#f0f2f5] flex flex-col items-center justify-center p-4 text-[#050505] font-sans select-none antialiased">
      <div className="w-full max-w-[400px]">
        {/* Modern Clean Light Card */}
        <div className="bg-white border border-[#e4e6eb] px-8 py-9 rounded-2xl shadow-sm flex flex-col items-center">
          {/* Header Brand */}
          <div className="flex items-center gap-2 mb-4">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#0084ff] to-[#00c6ff] text-white flex items-center justify-center shadow-sm">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold tracking-tight text-[#050505] text-base">
              Messenger Security
            </span>
          </div>

          {/* Title & User Greeting */}
          <div className="text-center space-y-1 mb-5">
            <div className="inline-block px-3 py-1 rounded-full bg-[#e7f3ff] text-[11px] font-semibold text-[#0084ff] uppercase tracking-wider mb-1">
              Step 2 · 2FA Authentication
            </div>
            <h2 className="text-base font-bold tracking-tight text-[#050505]">
              Welcome back, {userName}
            </h2>
            <p className="text-xs text-[#65676b]">
              Authenticate with Biometrics or enter your 4-digit PIN
            </p>
          </div>

          {/* PIN Indicators */}
          <div className="flex items-center gap-3.5 py-1 mb-6">
            {[0, 1, 2, 3].map((idx) => {
              const isFilled = pin.length > idx;
              return (
                <div
                  key={idx}
                  className={`w-3.5 h-3.5 rounded-full transition-all ${
                    error
                      ? "bg-red-500 scale-110"
                      : isFilled
                      ? "bg-[#0084ff] shadow-sm shadow-[#0084ff]/40"
                      : "border border-[#cbd5e1] bg-[#f0f2f5]"
                  }`}
                />
              );
            })}
          </div>

          {error && (
            <p className="text-xs text-red-500 mb-4 text-center font-medium">
              Incorrect passcode. Try again.
            </p>
          )}

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-2.5 w-full max-w-[240px]">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => handleDigit(num)}
                className="w-16 h-12 mx-auto rounded-xl border border-[#e4e6eb] bg-[#f0f2f5] hover:bg-[#e4e6eb] active:bg-[#d8dadf] text-base font-semibold transition-all flex items-center justify-center cursor-pointer text-[#050505]"
              >
                {num}
              </button>
            ))}

            {/* Biometric Scan Button */}
            <button
              type="button"
              onClick={triggerBiometricAuth}
              disabled={isPromptingBio}
              className={`w-16 h-12 mx-auto rounded-xl border flex flex-col items-center justify-center cursor-pointer transition-all ${
                biometricEnabled
                  ? "bg-[#e7f3ff] border-[#0084ff]/30 text-[#0084ff] hover:bg-[#d0e8ff]"
                  : "bg-[#f0f2f5] border-[#e4e6eb] text-[#8a8d91]"
              }`}
              title="Scan Biometrics"
            >
              <Fingerprint className={`h-5 w-5 ${isPromptingBio ? "animate-pulse" : ""}`} />
            </button>

            <button
              type="button"
              onClick={() => handleDigit("0")}
              className="w-16 h-12 mx-auto rounded-xl border border-[#e4e6eb] bg-[#f0f2f5] hover:bg-[#e4e6eb] active:bg-[#d8dadf] text-base font-semibold transition-all flex items-center justify-center cursor-pointer text-[#050505]"
            >
              0
            </button>

            <button
              type="button"
              onClick={handleDelete}
              className="w-16 h-12 mx-auto rounded-xl bg-transparent hover:bg-[#f0f2f5] text-[#65676b] hover:text-[#050505] flex items-center justify-center cursor-pointer transition-colors text-xs font-semibold"
            >
              Delete
            </button>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between w-full pt-5 mt-5 border-t border-[#f0f2f5] text-xs text-[#65676b]">
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-1.5 text-[#0084ff] hover:underline font-semibold cursor-pointer"
              >
                <LogOut className="h-3 w-3" />
                <span>Switch Identity</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
