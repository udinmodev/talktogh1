"use client";

import React, { useState } from "react";
import { loginUser, registerUser, AuthUser } from "@/lib/auth";
import {
  Shield,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  KeyRound,
  User,
  ArrowRight,
  Sparkles,
} from "lucide-react";

interface AuthLoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
}

export function AuthLoginPage({ onLoginSuccess }: AuthLoginPageProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [capacity, setCapacity] = useState<{
    userCount: number;
    maxCapacity: number;
    isRegistrationClosed: boolean;
  }>({ userCount: 0, maxCapacity: 3, isRegistrationClosed: false });

  React.useEffect(() => {
    fetch("/api/auth/register")
      .then((r) => r.json())
      .then((data) => {
        if (data && data.success) {
          const isClosed = Boolean(data.isRegistrationClosed);
          setCapacity({
            userCount: Number(data.userCount) || 0,
            maxCapacity: Number(data.maxCapacity) || 3,
            isRegistrationClosed: isClosed,
          });
          if (isClosed) {
            setMode("login");
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === "login") {
        const res = await loginUser(username, password);
        if (res.success && res.user) {
          onLoginSuccess(res.user);
        } else {
          setError(res.error || "Sorry, your credentials were incorrect.");
        }
      } else {
        if (capacity.isRegistrationClosed) {
          setError("Registration is closed. This private network only allows 3 users.");
          setLoading(false);
          return;
        }
        const res = await registerUser(username, password, displayName);
        if (res.success && res.user) {
          onLoginSuccess(res.user);
        } else {
          setError(res.error || "Could not register identity.");
        }
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const isFormValid =
    mode === "login"
      ? username.trim().length > 0 && password.length >= 4
      : username.trim().length >= 3 && password.length >= 4 && displayName.trim().length > 0;

  return (
    <div className="min-h-screen bg-[#f0f2f5] text-[#050505] flex flex-col justify-between py-10 px-4 font-sans antialiased select-none">
      {/* Centered Modern Clean Messenger Card */}
      <main className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-[420px] flex flex-col">
          <div className="bg-white border border-[#e4e6eb] px-8 sm:px-10 py-10 rounded-2xl shadow-sm">
            {/* Header / Messenger Brand */}
            <div className="mb-6 flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#0084ff] to-[#00c6ff] text-white flex items-center justify-center mb-3 shadow-md shadow-[#0084ff]/25">
                <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2C6.477 2 2 6.145 2 11.258c0 2.915 1.453 5.518 3.731 7.195V22l3.39-1.861c.904.25 1.874.385 2.879.385 5.523 0 10-4.145 10-9.266C22 6.145 17.523 2 12 2zm1.066 12.464l-2.613-2.787-5.1 2.787 5.61-5.955 2.68 2.787 5.033-2.787-5.61 5.955z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-[#050505]">
                {mode === "login" ? "Sign in" : "Create account"}
              </h1>
              <p className="text-sm text-[#65676b] mt-1 font-normal">
                {capacity.isRegistrationClosed
                  ? `Private Messenger • Network Full (${capacity.userCount}/${capacity.maxCapacity || 3} users)`
                  : mode === "login"
                  ? "Connect securely on TalkTogether"
                  : `Private Messenger • ${capacity.userCount}/${capacity.maxCapacity || 3} Registered`}
              </p>
            </div>

            {/* Messenger Pill Tab Switcher */}
            <div className="p-1 bg-[#f0f2f5] rounded-full flex items-center justify-center gap-1 mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
                className={`flex-1 py-1.5 px-4 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  mode === "login"
                    ? "bg-white text-[#0084ff] shadow-xs"
                    : "text-[#65676b] hover:text-[#050505]"
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                disabled={capacity.isRegistrationClosed}
                onClick={() => {
                  if (capacity.isRegistrationClosed) {
                    setError(`Registration is closed. This private network only allows ${capacity.maxCapacity || 3} users maximum.`);
                    return;
                  }
                  setMode("register");
                  setError(null);
                }}
                className={`flex-1 py-1.5 px-4 rounded-full text-xs font-semibold transition-all ${
                  capacity.isRegistrationClosed
                    ? "text-[#8a8d91] opacity-60 cursor-not-allowed"
                    : mode === "register"
                    ? "bg-white text-[#0084ff] shadow-xs cursor-pointer"
                    : "text-[#65676b] hover:text-[#050505] cursor-pointer"
                }`}
                title={capacity.isRegistrationClosed ? `Network full: ${capacity.maxCapacity || 3} users maximum` : undefined}
              >
                {capacity.isRegistrationClosed ? `Closed (${capacity.userCount}/${capacity.maxCapacity || 3})` : "Create account"}
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                <span className="leading-tight">{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "register" && (
                <div>
                  <label className="text-xs font-semibold text-[#65676b] mb-1.5 block">
                    Display Name
                  </label>
                  <div className="flex items-center rounded-xl bg-[#f0f2f5] border border-transparent focus-within:border-[#0084ff] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0084ff]/20 px-3.5 py-2.5 transition-all">
                    <User className="h-4 w-4 text-[#8a8d91] mr-2.5 shrink-0" />
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full bg-transparent text-sm text-[#050505] placeholder:text-[#8a8d91] focus:outline-none"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-[#65676b] mb-1.5 block">
                  {mode === "login" ? "Email or Username" : "Email or Username"}
                </label>
                <div className="flex items-center rounded-xl bg-[#f0f2f5] border border-transparent focus-within:border-[#0084ff] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0084ff]/20 px-3.5 py-2.5 transition-all">
                  <User className="h-4 w-4 text-[#8a8d91] mr-2.5 shrink-0" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => {
                      const val = e.target.value.trim().toLowerCase();
                      setUsername(val.startsWith("@") ? val.slice(1) : val);
                    }}
                    placeholder="email or username (e.g. vijay or user@example.com)"
                    className="w-full bg-transparent text-sm text-[#050505] placeholder:text-[#8a8d91] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[#65676b]">
                    Password
                  </label>
                  {password.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-xs text-[#0084ff] hover:underline font-semibold cursor-pointer"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  )}
                </div>
                <div className="flex items-center rounded-xl bg-[#f0f2f5] border border-transparent focus-within:border-[#0084ff] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0084ff]/20 px-3.5 py-2.5 transition-all">
                  <KeyRound className="h-4 w-4 text-[#8a8d91] mr-2.5 shrink-0" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full bg-transparent text-sm text-[#050505] placeholder:text-[#8a8d91] focus:outline-none"
                  />
                </div>
              </div>

              {/* Messenger Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading || !isFormValid}
                  className={`w-full py-3 px-5 rounded-xl text-sm font-semibold transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-xs ${
                    !loading && isFormValid
                      ? "bg-[#0084ff] text-white hover:bg-[#0073e6] active:scale-[0.99]"
                      : "bg-[#e4e6eb] text-[#8a8d91] cursor-not-allowed"
                  }`}
                >
                  {loading ? (
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>{mode === "login" ? "Continue" : "Create account"}</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Hardware Biometric & PIN Notice */}
            <div className="mt-6 pt-5 border-t border-[#f0f2f5] flex items-center justify-center gap-2 text-center">
              <ShieldCheck className="h-4 w-4 text-[#0084ff] shrink-0" />
              <span className="text-xs text-[#65676b] leading-tight">
                2-Step Biometric & PIN Hardware Protection
              </span>
            </div>
          </div>

          {/* Minimal Reassurance */}
          <div className="text-center mt-5">
            <span className="text-xs text-[#8a8d91]">
              Zero-Knowledge wire encryption with hardware-level privacy guard.
            </span>
          </div>
        </div>
      </main>

      {/* Clean Minimalist Footer */}
      <footer className="w-full max-w-[850px] mx-auto pt-6 text-center text-xs text-[#8a8d91] space-y-2 select-none">
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-1">
          <span className="hover:text-[#050505] cursor-pointer">About</span>
          <span className="hover:text-[#050505] cursor-pointer">End-to-End Encryption</span>
          <span className="hover:text-[#050505] cursor-pointer">Biometric Guard</span>
          <span className="hover:text-[#050505] cursor-pointer">Safety Numbers</span>
          <span className="hover:text-[#050505] cursor-pointer">Privacy & Terms</span>
        </div>
        <div className="text-[#bcc0c4] text-[11px]">
          © 2026 TALKTOGETHER · REALTIME ENCRYPTED MESSAGING
        </div>
      </footer>
    </div>
  );
}
