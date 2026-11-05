"use client";

import React, { useState } from "react";
import { Lock, Delete, Shield, Fingerprint } from "lucide-react";

interface AppLockScreenProps {
  correctPin: string;
  onUnlock: () => void;
  onPanicBurn: () => void;
}

export function AppLockScreen({
  correctPin,
  onUnlock,
  onPanicBurn,
}: AppLockScreenProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  const handleDigit = (digit: string) => {
    if (pin.length < 4) {
      const nextPin = pin + digit;
      setPin(nextPin);
      setError(false);
      if (nextPin.length === 4) {
        if (nextPin === correctPin) {
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
    <div className="fixed inset-0 z-50 bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-900 select-none">
      <div className="w-full max-w-xs flex flex-col items-center space-y-6">
        {/* Lock Icon */}
        <div className="relative">
          <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
            <Lock className="h-8 w-8 text-slate-900" />
          </div>
          <div className="absolute -bottom-1 -right-1 bg-slate-900 rounded-md p-1">
            <Shield className="h-3.5 w-3.5 text-white" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-1">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">Enter Passcode</h2>
          <p className="text-xs text-slate-500">
            Please enter your 4-digit PIN to access this chat
          </p>
        </div>

        {/* PIN Indicators */}
        <div className="flex items-center gap-3.5 py-1">
          {[0, 1, 2, 3].map((idx) => {
            const isFilled = pin.length > idx;
            return (
              <div
                key={idx}
                className={`w-3.5 h-3.5 rounded-full transition-colors ${
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
        <div className="grid grid-cols-3 gap-3.5 w-full pt-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              onClick={() => handleDigit(num)}
              className="w-16 h-16 mx-auto rounded-full bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-xl font-medium transition-colors flex items-center justify-center cursor-pointer text-slate-800"
            >
              {num}
            </button>
          ))}
          <button
            onClick={() => {
              setPin(correctPin);
              setTimeout(() => onUnlock(), 300);
            }}
            className="w-16 h-16 mx-auto rounded-full bg-transparent hover:bg-slate-100 text-slate-600 flex flex-col items-center justify-center cursor-pointer transition-colors"
            title="Biometric Unlock"
          >
            <Fingerprint className="h-6 w-6" />
          </button>
          <button
            onClick={() => handleDigit("0")}
            className="w-16 h-16 mx-auto rounded-full bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-xl font-medium transition-colors flex items-center justify-center cursor-pointer text-slate-800"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            className="w-16 h-16 mx-auto rounded-full bg-transparent hover:bg-slate-100 text-slate-400 hover:text-slate-800 flex items-center justify-center cursor-pointer transition-colors"
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>

        {/* Emergency Wipe Link */}
        <div className="pt-2">
          <button
            onClick={() => {
              if (
                window.confirm(
                  "Are you sure you want to trigger emergency data wipe? All messages will be permanently deleted."
                )
              ) {
                onPanicBurn();
              }
            }}
            className="text-xs text-rose-600/80 hover:text-rose-700 transition-colors underline underline-offset-4 cursor-pointer"
          >
            Emergency Wipe
          </button>
        </div>
      </div>
    </div>
  );
}
