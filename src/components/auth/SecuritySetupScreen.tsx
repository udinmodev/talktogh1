"use client";

import React, { useState, useEffect } from "react";
import { AuthUser, completeSecuritySetup } from "@/lib/auth";
import { registerBiometric, checkBiometricSupport, BiometricAvailability } from "@/lib/biometric";
import { Lock, Fingerprint, ShieldCheck, Check, ArrowRight, Shield } from "lucide-react";

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
    <div className="min-h-screen bg-[#fafafa] flex flex-col justify-between py-10 px-4 text-[#262626] font-sans antialiased selection:bg-blue-100 select-none">
      <main className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-[350px]">
          {/* Flat Instagram-style Sharp Box */}
          <div className="bg-white border border-[#dbdbdb] px-8 pt-9 pb-8 rounded-[1px] text-center flex flex-col items-center">
            {/* Header Brand */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-md bg-slate-900 text-white flex items-center justify-center">
                <Shield className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <span className="font-mono font-bold tracking-tight text-slate-900 text-base">
                WECHAT SECURITY
              </span>
            </div>

            {/* Step Progress Bar */}
            <div className="flex items-center gap-1.5 mb-6 w-full justify-center">
              <div
                className={`h-1 rounded-full transition-all ${
                  step === "pin" || step === "confirm_pin"
                    ? "w-10 bg-[#0095f6]"
                    : "w-4 bg-emerald-500"
                }`}
              />
              <div
                className={`h-1 rounded-full transition-all ${
                  step === "biometric" ? "w-10 bg-[#0095f6]" : "w-4 bg-[#dbdbdb]"
                }`}
              />
            </div>

            {/* STEP 1: SET & CONFIRM 4-DIGIT PIN */}
            {(step === "pin" || step === "confirm_pin") && (
              <div className="w-full flex flex-col items-center">
                <div className="w-12 h-12 rounded-full border border-[#dbdbdb] bg-[#fafafa] flex items-center justify-center text-slate-800 mb-3">
                  <Lock className="h-5 w-5 text-slate-700" />
                </div>

                <h2 className="text-sm font-bold text-slate-900 mb-1">
                  {step === "pin" ? "Create 4-Digit Passcode" : "Confirm Passcode"}
                </h2>
                <p className="text-[11.5px] text-[#737373] text-center mb-5 max-w-[260px] leading-relaxed">
                  {step === "pin"
                    ? "Enter a 4-digit PIN to secure your conversations."
                    : "Re-enter the same 4-digit PIN to verify."}
                </p>

                {/* PIN Dots */}
                <div className="flex items-center gap-3 mb-6">
                  {[0, 1, 2, 3].map((idx) => {
                    const currentVal = step === "pin" ? pin : confirmPin;
                    const isFilled = currentVal.length > idx;
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
                    {error}
                  </p>
                )}

                {/* Number Pad */}
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
                  <div />
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
              </div>
            )}

            {/* STEP 2: CONFIGURE BIOMETRICS */}
            {step === "biometric" && (
              <div className="w-full flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                  <Fingerprint className="h-7 w-7" />
                </div>

                <h2 className="text-sm font-bold text-slate-900 mb-1">
                  Enable Biometric Login
                </h2>
                <p className="text-[11.5px] text-[#737373] mb-5 max-w-[260px] leading-relaxed">
                  Use Touch ID, Face ID, or Windows Hello for instant one-touch login.
                </p>

                <div className="w-full bg-[#fafafa] border border-[#dbdbdb] rounded-[3px] p-3 mb-5 text-left flex items-start gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-[11px]">
                    <div className="font-semibold text-[#262626]">
                      {bioSupport?.platform
                        ? "Platform Biometrics Detected"
                        : "Device Sensor Supported"}
                    </div>
                    <div className="text-[#737373] text-[10px] mt-0.5">
                      Hardware protected. Keys never leave this browser.
                    </div>
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-[#ed4956] mb-3 text-center">
                    {error}
                  </p>
                )}

                {!bioEnrolled ? (
                  <div className="w-full space-y-2">
                    <button
                      type="button"
                      onClick={handleEnrollBiometric}
                      disabled={isBioEnrolling}
                      className="w-full py-2 px-4 bg-[#0095f6] hover:bg-[#1877f2] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Fingerprint className="h-3.5 w-3.5" />
                      <span>{isBioEnrolling ? "Verifying..." : "Enable Biometrics"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleFinishSetup(false)}
                      className="w-full py-2 px-4 bg-transparent hover:bg-[#f0f0f0] text-[#737373] hover:text-[#262626] rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Skip (Use PIN Only)
                    </button>
                  </div>
                ) : (
                  <div className="w-full space-y-3">
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-[3px] text-emerald-700 text-xs font-semibold flex items-center justify-center gap-1.5">
                      <Check className="h-3.5 w-3.5" />
                      <span>Biometric Enrolled Successfully</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleFinishSetup(true)}
                      className="w-full py-2 px-4 bg-[#0095f6] hover:bg-[#1877f2] text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>Continue to Chat</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="text-center text-[11px] text-[#8e8e8e]">
        © 2026 WECHAT SECURE MESSENGER · HARDWARE SECURITY
      </footer>
    </div>
  );
}
