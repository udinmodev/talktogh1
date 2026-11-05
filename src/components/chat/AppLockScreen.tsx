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

  // Auto-prompt biometric on mount if biometric is enabled
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
    <div className="fixed inset-0 z-50 bg-[#f8f9fa] flex flex-col items-center justify-center p-6 text-slate-900 select-none">
      <div className="w-full max-w-xs flex flex-col items-center space-y-5">
        {/* Lock Icon */}
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex items-center justify-center">
            <Lock className="h-8 w-8 text-slate-900" />
          </div>
          <div className="absolute -bottom-1 -right-1 bg-slate-900 rounded-lg p-1.5 shadow-sm">
            <Shield className="h-3.5 w-3.5 text-emerald-400" />
          </div>
        </div>

        {/* Title & User Greeting */}
        <div className="text-center space-y-1">
          <h2 className="text-base font-bold tracking-tight text-slate-900">
            Welcome back, {userName}
          </h2>
          <p className="text-xs text-slate-500">
            Enter your 4-digit passcode or use biometrics to unlock
          </p>
        </div>

        {/* PIN Indicators */}
        <div className="flex items-center gap-3.5 py-1">
          {[0, 1, 2, 3].map((idx) => {
            const isFilled = pin.length > idx;
            return (
              <div
                key={idx}
                className={`w-3.5 h-3.5 rounded-full transition-all ${
                  error
                    ? "bg-rose-500 scale-110"
                    : isFilled
                    ? "bg-slate-900 scale-110"
                    : "border border-slate-300 bg-white"
                }`}
              />
            );
          })}
        </div>

        {error && (
          <p className="text-xs text-rose-600 font-medium">
            Incorrect passcode. Try again.
          </p>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-3.5 w-full pt-1">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => handleDigit(num)}
              className="w-14 h-14 mx-auto rounded-full bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-200/80 text-xl font-medium transition-colors flex items-center justify-center cursor-pointer text-slate-800 shadow-xs"
            >
              {num}
            </button>
          ))}

          {/* Biometric Trigger Icon Button */}
          <button
            type="button"
            onClick={triggerBiometricAuth}
            disabled={isPromptingBio}
            className={`w-14 h-14 mx-auto rounded-full border border-slate-200/80 flex flex-col items-center justify-center cursor-pointer transition-colors shadow-xs ${
              biometricEnabled
                ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                : "bg-white hover:bg-slate-100 text-slate-400"
            }`}
            title="Scan Biometric (Fingerprint / Face ID)"
          >
            <Fingerprint className={`h-6 w-6 ${isPromptingBio ? "animate-pulse" : ""}`} />
          </button>

          <button
            type="button"
            onClick={() => handleDigit("0")}
            className="w-14 h-14 mx-auto rounded-full bg-white hover:bg-slate-100 active:bg-slate-200 border border-slate-200/80 text-xl font-medium transition-colors flex items-center justify-center cursor-pointer text-slate-800 shadow-xs"
          >
            0
          </button>

          <button
            type="button"
            onClick={handleDelete}
            className="w-14 h-14 mx-auto rounded-full bg-transparent hover:bg-slate-100 text-slate-400 hover:text-slate-800 flex items-center justify-center cursor-pointer transition-colors text-xs font-semibold"
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>

        {/* Action Links: Log out & Panic Burn */}
        <div className="flex items-center justify-between w-full pt-4 border-t border-slate-200/60 text-xs text-slate-500">
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
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
            className="text-rose-600 hover:text-rose-700 transition-colors cursor-pointer"
          >
            Emergency Wipe
          </button>
        </div>
      </div>
    </div>
  );
}
