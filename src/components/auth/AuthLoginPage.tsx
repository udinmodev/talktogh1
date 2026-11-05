"use client";

import React, { useState } from "react";
import { loginUser, registerUser, AuthUser } from "@/lib/auth";
import { Shield, Lock, User, KeyRound, ArrowRight, Sparkles, CheckCircle2 } from "lucide-react";

interface AuthLoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
}

export function AuthLoginPage({ onLoginSuccess }: AuthLoginPageProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
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
          setError(res.error || "Login failed");
        }
      } else {
        const res = await registerUser(username, password, displayName);
        if (res.success && res.user) {
          onLoginSuccess(res.user);
        } else {
          setError(res.error || "Registration failed");
        }
      }
    } catch {
      setError("An unexpected authentication error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (quickUsername: string) => {
    setUsername(quickUsername);
    setPassword("admin123");
    setError(null);
    setLoading(true);
    const res = await loginUser(quickUsername, "admin123");
    setLoading(false);
    if (res.success && res.user) {
      onLoginSuccess(res.user);
    } else {
      setError(res.error || "Login failed");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#f8f9fa] flex flex-col items-center justify-center p-4 select-none">
      <div className="w-full max-w-sm">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-sm mb-3">
            <Shield className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Secure Messenger
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
            Zero-Knowledge E2EE channel with native Biometric & Passcode security
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-sm">
          {/* Mode Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-xl mb-5">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                mode === "login"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError(null);
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                mode === "register"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              New Identity
            </button>
          </div>

          {error && (
            <div className="mb-4 p-2.5 rounded-xl bg-rose-50 border border-rose-200/80 text-rose-700 text-xs flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === "register" && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Display Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. John Doe"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 transition-colors"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Username / Identity ID
              </label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
                  placeholder="e.g. alice, bob, or myidentity"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-900 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !username || !password}
              className={`w-full py-2.5 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                loading || !username || !password
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                  : "bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
              }`}
            >
              <span>{loading ? "Authenticating..." : mode === "login" ? "Sign In" : "Create Account"}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </form>

          {/* Quick Demo Identities */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider text-center mb-2.5">
              Quick Test Profiles
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin("alice")}
                className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left transition-colors cursor-pointer flex items-center gap-2"
              >
                <div className="w-7 h-7 rounded-full bg-emerald-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  A
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-800 truncate">Alice Vance</div>
                  <div className="text-[10px] text-slate-500">Owner</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin("bob")}
                className="p-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left transition-colors cursor-pointer flex items-center gap-2"
              >
                <div className="w-7 h-7 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
                  B
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-800 truncate">Bob Mercer</div>
                  <div className="text-[10px] text-slate-500">Contact</div>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Security badge footer */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <Lock className="h-3.5 w-3.5" />
          <span>Biometric & PIN security required after login</span>
        </div>
      </div>
    </div>
  );
}
