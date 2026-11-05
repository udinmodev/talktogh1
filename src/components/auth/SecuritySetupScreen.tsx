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
    } else {
      setConfirmPin((prev) => prev.slice(0, -1));
    }
  };

  const handleEnrollBiometric = async () => {
    setIsBioEnrolling(true);
    setError(null);
    try {
      const res = await registerBiometric(user.username, user.name);
      if (res.success && res.credentialId) {
        setBioCredId(res.credentialId);
        setBioEnrolled(true);
      } else {
        setError(res.error || "Biometric registration failed. You can use PIN only.");
      }
    } catch {
      setError("Biometric prompt cancelled or unsupported.");
    } finally {
      setIsBioEnrolling(false);
    }
  };

  const handleFinishSetup = async (withBiometrics: boolean) => {
    const updated = await completeSecuritySetup(user.username, pin, withBiometrics, bioCredId);
    if (updated) {
      onComplete(updated);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f2f5] text-[#050505] flex flex-col justify-between py-10 px-4 font-sans antialiased select-none">
      <main className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-[400px]">
          {/* Modern Clean Light Card */}
          <div className="bg-white border border-[#e4e6eb] px-8 pt-9 pb-8 rounded-2xl shadow-sm text-center flex flex-col items-center">
            {/* Header Brand */}
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#0084ff] to-[#00c6ff] text-white flex items-center justify-center shadow-sm">
                <Shield className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold tracking-tight text-[#050505] text-base">
                Messenger Security
              </span>
            </div>

            {/* Step Progress Pill */}
            <div className="flex items-center gap-1.5 mb-6 w-full justify-center">
              <div
                className={`h-1 rounded-full transition-all ${
                  step === "pin" || step === "confirm_pin"
                    ? "w-10 bg-[#0084ff]"
                    : "w-4 bg-[#0084ff]"
                }`}
              />
              <div
                className={`h-1 rounded-full transition-all ${
                  step === "biometric" ? "w-10 bg-[#0084ff]" : "w-4 bg-[#e4e6eb]"
                }`}
              />
            </div>

            {/* STEP 1: SET & CONFIRM 4-DIGIT PIN */}
            {(step === "pin" || step === "confirm_pin") && (
              <div className="w-full flex flex-col items-center">
                <div className="w-12 h-12 rounded-full border border-[#e4e6eb] bg-[#f0f2f5] flex items-center justify-center text-[#050505] mb-3">
                  <Lock className="h-5 w-5 text-[#0084ff]" />
                </div>

                <h2 className="text-base font-bold text-[#050505] mb-1">
                  {step === "pin" ? "Create 4-Digit Passcode" : "Confirm Passcode"}
                </h2>
                <p className="text-xs text-[#65676b] text-center mb-5 max-w-[280px] leading-relaxed">
                  {step === "pin"
                    ? "Enter a 4-digit PIN to secure your confidential conversations."
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
                  <p className="text-xs text-red-500 mb-3 text-center font-medium">
                    {error}
                  </p>
                )}

                {/* Number Pad */}
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
                  <div />
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
              </div>
            )}

            {/* STEP 2: CONFIGURE BIOMETRICS */}
            {step === "biometric" && (
              <div className="w-full flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-full border border-[#0084ff]/30 bg-[#e7f3ff] text-[#0084ff] flex items-center justify-center mb-3">
                  <Fingerprint className="h-7 w-7" />
                </div>

                <h2 className="text-base font-bold text-[#050505] mb-1">
                  Enable Biometric Login
                </h2>
                <p className="text-xs text-[#65676b] mb-5 max-w-[280px] leading-relaxed">
                  Use Touch ID, Face ID, or Windows Hello for instant one-touch login.
                </p>

                <div className="w-full bg-[#f0f2f5] border border-[#e4e6eb] rounded-xl p-3.5 mb-5 text-left flex items-start gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-[#0084ff] shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <div className="font-semibold text-[#050505]">
                      {bioSupport?.platform
                        ? "Platform Biometrics Detected"
                        : "Device Sensor Supported"}
                    </div>
                    <div className="text-[#65676b] text-[11px] mt-0.5">
                      Hardware protected. Keys never leave this device.
                    </div>
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-red-500 mb-3 text-center font-medium">
                    {error}
                  </p>
                )}

                {!bioEnrolled ? (
                  <div className="w-full space-y-2.5">
                    <button
                      type="button"
                      onClick={handleEnrollBiometric}
                      disabled={isBioEnrolling}
                      className="w-full py-3 px-5 bg-[#0084ff] hover:bg-[#0073e6] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                    >
                      <Fingerprint className="h-4 w-4" />
                      <span>{isBioEnrolling ? "Verifying Sensor..." : "Enable Biometrics"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleFinishSetup(false)}
                      className="w-full py-2.5 px-5 bg-transparent hover:bg-[#f0f2f5] text-[#65676b] hover:text-[#050505] rounded-xl text-xs font-medium transition-colors cursor-pointer"
                    >
                      Skip (Use PIN Only)
                    </button>
                  </div>
                ) : (
                  <div className="w-full space-y-3">
                    <div className="p-3 bg-[#e7f3ff] border border-[#0084ff]/20 rounded-xl text-[#0084ff] text-xs font-semibold flex items-center justify-center gap-1.5">
                      <Check className="h-4 w-4" />
                      <span>Biometric Enrolled Successfully</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleFinishSetup(true)}
                      className="w-full py-3 px-5 bg-[#0084ff] hover:bg-[#0073e6] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
                    >
                      <span>Continue to Chat</span>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="text-center text-xs text-[#8a8d91]">
        © 2026 MESSENGER · HARDWARE TWO-FACTOR SECURITY
      </footer>
    </div>
  );
}
