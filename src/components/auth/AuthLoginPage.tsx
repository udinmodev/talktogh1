"use client";

import React, { useState } from "react";
import { loginUser, registerUser, AuthUser } from "@/lib/auth";
import {
  Shield,
  Lock,
  Fingerprint,
  CheckCircle2,
  Eye,
  EyeOff,
  ShieldCheck,
  KeyRound,
  MessageSquare,
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
    <div className="min-h-screen bg-[#fafafa] flex flex-col justify-between py-10 px-4 text-[#262626] font-sans antialiased selection:bg-blue-100 select-none">
      {/* Centered Login Box */}
      <main className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-[350px] flex flex-col">
          {/* Primary Instagram-style Box */}
          <div className="bg-white border border-[#dbdbdb] px-8 sm:px-10 pt-10 pb-7 rounded-[1px] text-center">
              {/* Brand Typography Wordmark */}
              <div className="mb-7 flex flex-col items-center">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                    <Shield className="h-4 w-4 text-emerald-400" />
                  </div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-900 font-mono">
                    WECHAT
                  </h1>
                </div>
                <span className="text-[11px] font-medium tracking-widest text-[#737373] uppercase">
                  CONFIDENTIAL MESSENGER
                </span>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 text-center text-xs text-[#ed4956] leading-tight">
                  {error}
                </div>
              )}

              {/* Instagram-style Form */}
              <form onSubmit={handleSubmit} className="space-y-1.5 text-left">
                {mode === "register" && (
                  <div>
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Full Name"
                      className="w-full bg-[#fafafa] border border-[#dbdbdb] rounded-[3px] text-xs px-2.5 py-2.5 text-[#262626] placeholder:text-[#8e8e8e] focus:bg-white focus:border-[#a8a8a8] outline-none transition-colors"
                    />
                  </div>
                )}

                <div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
                    placeholder="Phone number, username, or identity ID"
                    className="w-full bg-[#fafafa] border border-[#dbdbdb] rounded-[3px] text-xs px-2.5 py-2.5 text-[#262626] placeholder:text-[#8e8e8e] focus:bg-white focus:border-[#a8a8a8] outline-none transition-colors"
                  />
                </div>

                <div className="relative flex items-center">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full bg-[#fafafa] border border-[#dbdbdb] rounded-[3px] text-xs px-2.5 py-2.5 pr-14 text-[#262626] placeholder:text-[#8e8e8e] focus:bg-white focus:border-[#a8a8a8] outline-none transition-colors"
                  />
                  {password.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 text-xs font-semibold text-[#262626] hover:text-[#737373] cursor-pointer select-none"
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  )}
                </div>

                {/* Primary Action Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading || !isFormValid}
                    className={`w-full py-1.5 px-4 rounded-lg text-sm font-semibold transition-all cursor-pointer flex items-center justify-center ${
                      !loading && isFormValid
                        ? "bg-[#0095f6] hover:bg-[#1877f2] active:opacity-70 text-white"
                        : "bg-[#4cb5f9] text-white opacity-70 cursor-not-allowed"
                    }`}
                  >
                    {loading ? (
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : mode === "login" ? (
                      "Log in"
                    ) : (
                      "Sign up"
                    )}
                  </button>
                </div>
              </form>

              {/* Security Policy Reminder */}
              <div className="mt-4 pt-3 border-t border-[#f0f0f0]">
                <span className="text-[11px] text-[#737373] block leading-tight">
                  Protected with hardware Biometrics (Touch ID / Face ID) and 4-digit PIN.
                </span>
              </div>
            </div>

            {/* Secondary Instagram-style Box (Sign up / Log in Switcher) */}
            <div className="bg-white border border-[#dbdbdb] py-5 px-6 rounded-[1px] text-center text-xs mt-2.5">
              {mode === "login" ? (
                <span>
                  Don&apos;t have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("register");
                      setError(null);
                    }}
                    className="font-semibold text-[#0095f6] hover:text-[#00376b] cursor-pointer"
                  >
                    Sign up
                  </button>
                </span>
              ) : (
                <span>
                  Have an account?{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setError(null);
                    }}
                    className="font-semibold text-[#0095f6] hover:text-[#00376b] cursor-pointer"
                  >
                    Log in
                  </button>
                </span>
              )}
            </div>

            {/* Minimal App Security Reassurance */}
            <div className="text-center mt-4">
              <span className="text-[11.5px] text-[#737373]">
                Zero-Knowledge wire encryption powered by Supabase.
              </span>
            </div>
          </div>
        </main>

      {/* Instagram-style Minimalist Footer */}
      <footer className="w-full max-w-[850px] mx-auto pt-6 text-center text-[11px] text-[#737373] space-y-2.5 select-none">
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
          <span className="hover:underline cursor-pointer">About</span>
          <span className="hover:underline cursor-pointer">End-to-End Encryption</span>
          <span className="hover:underline cursor-pointer">Biometric Guard</span>
          <span className="hover:underline cursor-pointer">Safety Numbers</span>
          <span className="hover:underline cursor-pointer">Supabase DB</span>
          <span className="hover:underline cursor-pointer">Privacy</span>
          <span className="hover:underline cursor-pointer">Terms</span>
        </div>
        <div className="text-[#8e8e8e] text-[10.5px]">
          © 2026 WECHAT SECURE MESSENGER · REALTIME ENCRYPTION
        </div>
      </footer>
    </div>
  );
}
