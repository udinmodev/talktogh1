"use client";

import React, { useState, useEffect } from "react";
import { AuthUser, completeSecuritySetup } from "@/lib/auth";
import { registerBiometric, checkBiometricSupport, BiometricAvailability } from "@/lib/biometric";
import { Lock, Fingerprint, ShieldCheck, Check, ArrowRight, ShieldAlert, Sparkles } from "lucide-react";

interface SecuritySetupScreenProps {
  user: AuthUser;
  onComplete: (updatedUser: AuthUser) => void;
}

export function SecuritySetupScreen({ user, onComplete }: SecuritySetupScreenProps) {
  const [step, setStep] = useState<"pin" | "confirm_pin" | "biometric">("pin");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Biometric state
  const [bioSupport, setBioSupport] = useState<BiometricAvailability | null>(null);
  const [isBioEnrolling, setIsBioEnrolling] = useState(false);
  const [bioEnrolled, setBioEnrolled] = useState(false);
  const [bioCredId, setBioCredId] = useState<string | undefined>();

  useEffect(() => {
    checkBiometricSupport().then(setBioSupport);
  }, []);

  const handleDigit = (digit: string) => {
    setError(null);
    if (step === "pin") {
      if (pin.length < 4) {
        const next = pin + digit;
        setPin(next);
        if (next.length === 4) {
          setTimeout(() => {
            setStep("confirm_pin");
          }, 200);
        }
      }
    } else if (step === "confirm_pin") {
      if (confirmPin.length < 4) {
        const next = confirmPin + digit;
        setConfirmPin(next);
        if (next.length === 4) {
          if (next === pin) {
            setTimeout(() => {
              setStep("biometric");
            }, 250);
          } else {
            setError("Passcodes do not match. Please try again.");
            setTimeout(() => {
              setConfirmPin("");
              setStep("pin");
              setPin("");
            }, 800);
          }
        }
      }
    }
  };

  const handleDelete = () => {
    setError(null);
    if (step === "pin") {
      setPin((prev) => prev.slice(0, -1));
    } else if (step === "confirm_pin") {
      setConfirmPin((prev) => prev.slice(0, -1));
    }
  };

  const handleEnrollBiometric = async () => {
    setIsBioEnrolling(true);
    setError(null);
    try {
      const res = await registerBiometric(user.username, user.id);
      if (res.success && res.credentialId) {
        setBioEnrolled(true);
        setBioCredId(res.credentialId);
      } else {
        setError(res.error || "Biometric registration was declined");
      }
    } catch {
      setError("Biometric enrollment could not be completed");
    } finally {
      setIsBioEnrolling(false);
    }
  };

  const handleFinishSetup = (enableBio: boolean) => {
    const updated = completeSecuritySetup(
      user.username,
      pin,
      enableBio,
      enableBio ? bioCredId : undefined
    );
    onComplete(updated);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#f8f9fa] flex flex-col items-center justify-center p-4 select-none">
      <div className="w-full max-w-sm bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm flex flex-col items-center">
        {/* Progress tracker */}
        <div className="flex items-center gap-2 mb-6 w-full justify-center">
          <div
            className={`h-1.5 rounded-full transition-all ${
              step === "pin" || step === "confirm_pin"
                ? "w-8 bg-slate-900"
                : "w-4 bg-emerald-500"
            }`}
          />
          <div
            className={`h-1.5 rounded-full transition-all ${
              step === "biometric" ? "w-8 bg-slate-900" : "w-4 bg-slate-200"
            }`}
          />
        </div>

        {/* STEP 1: SET & CONFIRM 4-DIGIT PIN */}
        {(step === "pin" || step === "confirm_pin") && (
          <div className="w-full flex flex-col items-center">
            {/* Header Icon */}
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-800 mb-3 border border-slate-200">
              <Lock className="h-6 w-6" />
            </div>

            <h2 className="text-base font-bold text-slate-900 mb-1">
              {step === "pin" ? "Create Security Passcode" : "Confirm Passcode"}
            </h2>
            <p className="text-xs text-slate-500 text-center mb-5 max-w-xs leading-relaxed">
              {step === "pin"
                ? "Choose a 4-digit PIN to secure your confidential chat session"
                : "Re-enter your 4-digit passcode to verify accuracy"}
            </p>

            {/* PIN Dots */}
            <div className="flex items-center gap-3.5 mb-6">
              {[0, 1, 2, 3].map((idx) => {
                const currentVal = step === "pin" ? pin : confirmPin;
                const isFilled = currentVal.length > idx;
                return (
                  <div
                    key={idx}
                    className={`w-3.5 h-3.5 rounded-full transition-all ${
                      error
                        ? "bg-rose-500 scale-110"
                        : isFilled
                        ? "bg-slate-900 scale-110"
                        : "border border-slate-300 bg-slate-50"
                    }`}
                  />
                );
              })}
            </div>

            {error && (
              <p className="text-xs text-rose-600 font-medium mb-3 text-center">
                {error}
              </p>
            )}

            {/* Number Pad */}
            <div className="grid grid-cols-3 gap-3 w-full max-w-[240px]">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleDigit(num)}
                  className="w-14 h-14 mx-auto rounded-full bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-lg font-medium transition-colors flex items-center justify-center cursor-pointer text-slate-800"
                >
                  {num}
                </button>
              ))}
              <div />
              <button
                type="button"
                onClick={() => handleDigit("0")}
                className="w-14 h-14 mx-auto rounded-full bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-lg font-medium transition-colors flex items-center justify-center cursor-pointer text-slate-800"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="w-14 h-14 mx-auto rounded-full bg-transparent hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center cursor-pointer transition-colors text-xs font-semibold"
              >
                Delete
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: CONFIGURE BIOMETRIC (TOUCH ID / FACE ID / WINDOWS HELLO) */}
        {step === "biometric" && (
          <div className="w-full flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mb-3">
              <Fingerprint className="h-7 w-7" />
            </div>

            <h2 className="text-base font-bold text-slate-900 mb-1">
              Enable Biometric Unlock
            </h2>
            <p className="text-xs text-slate-500 mb-5 max-w-xs leading-relaxed">
              Unlock your encrypted chats instantly using your device&apos;s Touch ID, Face ID, or Windows Hello sensor.
            </p>

            <div className="w-full bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 mb-5 text-left flex items-start gap-3">
              <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <div className="font-semibold text-slate-800">
                  {bioSupport?.platform
                    ? "Platform Biometrics Ready"
                    : "Hardware Sensor Supported"}
                </div>
                <div className="text-slate-500 text-[11px] mt-0.5">
                  Biometric credentials never leave this hardware device.
                </div>
              </div>
            </div>

            {error && (
              <p className="text-xs text-rose-600 font-medium mb-3 text-center">
                {error}
              </p>
            )}

            {!bioEnrolled ? (
              <div className="w-full space-y-2.5">
                <button
                  type="button"
                  onClick={handleEnrollBiometric}
                  disabled={isBioEnrolling}
                  className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                >
                  <Fingerprint className="h-4 w-4" />
                  <span>{isBioEnrolling ? "Verifying Sensor..." : "Activate Biometrics"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleFinishSetup(false)}
                  className="w-full py-2 px-4 bg-transparent hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                >
                  Skip for Now (Use Passcode Only)
                </button>
              </div>
            ) : (
              <div className="w-full space-y-3">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs font-semibold flex items-center justify-center gap-2">
                  <Check className="h-4 w-4" />
                  <span>Biometric Successfully Configured!</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleFinishSetup(true)}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
                >
                  <span>Launch Encrypted Chat</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
