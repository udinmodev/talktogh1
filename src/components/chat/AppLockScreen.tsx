"use client";

import React, { useState, useEffect } from "react";
import { Lock, Delete, Shield, Fingerprint, LogOut } from "lucide-react";
import { verifyBiometric } from "@/lib/biometric";
import { hashPin } from "@/lib/auth";

interface AppLockScreenProps {
  pinHash?: string;
  username: string;
  userName?: string;
  biometricEnabled?: boolean;
  biometricCredentialId?: string;
  onUnlock: () => void;
  onPanicBurn?: () => void;
  onLogout?: () => void;
}

export function AppLockScreen({
  pinHash,
  username,
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
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  // Auto-prompt biometric on mount if enabled
  useEffect(() => {
    if (biometricEnabled && cooldownSeconds === 0) {
      triggerBiometricAuth();
    }
  }, [biometricEnabled, cooldownSeconds]);

  const triggerBiometricAuth = async () => {
    if (cooldownSeconds > 0) return;
    setIsPromptingBio(true);
    try {
      const res = await verifyBiometric(biometricCredentialId);
      if (res.success) {
        setFailedAttempts(0);
        onUnlock();
      }
    } catch {
      // User cancelled or biometric failed; fallback to PIN
    } finally {
      setIsPromptingBio(false);
    }
  };

  const handleDigit = async (digit: string) => {
    if (cooldownSeconds > 0) return;
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError(false);
      if (nextPin.length === 4) {
        if (pinHash) {
          const enteredHash = await hashPin(nextPin, username);
          if (enteredHash === pinHash) {
            setFailedAttempts(0);
            onUnlock();
            return;
          }
        }
        const nextFailed = failedAttempts + 1;
        setFailedAttempts(nextFailed);
        setError(true);
        setTimeout(() => setPin(""), 600);

        if (nextFailed >= 5) {
          // Session lockout due to brute-force attempts
          setTimeout(() => {
            alert("Security Lockout: 5 failed PIN attempts exceeded. For your safety, this session has been locked.");
            onLogout?.();
          }, 650);
        } else if (nextFailed >= 3) {
          // 30-second penalty lockout
          setCooldownSeconds(30);
        }
      }
    }
  };

  const handleDelete = () => {
    if (cooldownSeconds > 0) return;
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
              TalkTogether Security
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

          {cooldownSeconds > 0 ? (
            <div className="text-xs text-amber-600 mb-4 text-center font-medium bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl animate-pulse">
              Too many failed attempts. Try again in {cooldownSeconds}s
            </div>
          ) : error ? (
            <p className="text-xs text-red-500 mb-4 text-center font-medium">
              Incorrect passcode ({failedAttempts}/5 attempts). Try again.
            </p>
          ) : null}

          {/* Keypad */}
          <div className={`grid grid-cols-3 gap-2.5 w-full max-w-[240px] ${cooldownSeconds > 0 ? "opacity-50 pointer-events-none" : ""}`}>
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
