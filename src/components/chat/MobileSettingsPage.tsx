"use client";

import React, { useState } from "react";
import { SecuritySettings, ThemeColor, ChatWallpaper, FontSize, BubbleStyle } from "@/types/chat";
import {
  ArrowLeft,
  ShieldCheck,
  Timer,
  Lock,
  EyeOff,
  Flame,
  KeyRound,
  Shield,
  Palette,
  Volume2,
  CornerDownLeft,
  CheckCheck,
  Check,
  Sparkles,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { soundManager } from "@/lib/sound";

interface MobileSettingsPageProps {
  settings: SecuritySettings;
  onUpdateSettings: (newSettings: Partial<SecuritySettings>) => void;
  onRotateKey: () => void;
  onOpenSafetyNumbers: () => void;
  onEmergencyWipe: () => void;
  onBack: () => void;
}

export function MobileSettingsPage({
  settings,
  onUpdateSettings,
  onOpenSafetyNumbers,
  onEmergencyWipe,
  onBack,
}: MobileSettingsPageProps) {
  const [activeTab, setActiveTab] = useState<"security" | "customization">("security");
  const [pinInput, setPinInput] = useState(settings.appLockPin || "1234");
  const [showWipeDialog, setShowWipeDialog] = useState(false);
  const [savedBadge, setSavedBadge] = useState(false);

  const triggerUpdate = (newOpts: Partial<SecuritySettings>) => {
    onUpdateSettings(newOpts);
    setSavedBadge(true);
    setTimeout(() => setSavedBadge(false), 1200);
  };

  const presets = [
    { label: "Off", value: 0 },
    { label: "30s", value: 30 },
    { label: "5m", value: 300 },
    { label: "24h", value: 86400 },
  ];

  const themeColors: { id: ThemeColor; name: string; bgClass: string }[] = [
    { id: "blue", name: "Classic Blue", bgClass: "bg-[#007aff]" },
    { id: "emerald", name: "WeChat Green", bgClass: "bg-[#07c160]" },
    { id: "slate", name: "Stealth Slate", bgClass: "bg-slate-900" },
    { id: "purple", name: "Royal Purple", bgClass: "bg-purple-600" },
    { id: "rose", name: "Crimson Rose", bgClass: "bg-rose-500" },
    { id: "amber", name: "Warm Amber", bgClass: "bg-amber-500" },
  ];

  const wallpapers: { id: ChatWallpaper; label: string }[] = [
    { id: "default", label: "Clean Flat" },
    { id: "dots", label: "Subtle Dots" },
    { id: "grid", label: "Grid" },
    { id: "warm", label: "Warm Ivory" },
    { id: "dark", label: "Dark Slate" },
  ];

  const fontSizes: { id: FontSize; label: string }[] = [
    { id: "small", label: "Small (12px)" },
    { id: "medium", label: "Standard (14px)" },
    { id: "large", label: "Large (16px)" },
  ];

  const bubbleStyles: { id: BubbleStyle; label: string }[] = [
    { id: "modern", label: "Modern" },
    { id: "pill", label: "Smooth Pill" },
    { id: "compact", label: "Compact" },
  ];

  return (
    <div className="w-full h-full flex flex-col bg-white overflow-hidden select-none">
      {/* iOS Style Flat Header */}
      <header className="h-14 px-4 bg-white flex items-center justify-between border-b border-slate-100 shrink-0 z-20">
        <button
          onClick={onBack}
          className="flex items-center gap-1 -ml-1 text-[#007aff] hover:opacity-80 transition-opacity cursor-pointer font-medium text-[15px]"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Chats</span>
        </button>
        <span className="font-semibold text-[16px] text-slate-900">
          Settings
        </span>
        <button
          onClick={onBack}
          className="text-[15px] font-semibold text-[#007aff] hover:opacity-80 transition-opacity cursor-pointer"
        >
          Done
        </button>
      </header>

      {/* Segmented Top Control */}
      <div className="p-3 bg-slate-50 border-b border-slate-100">
        <div className="flex bg-slate-200/70 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab("security")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "security"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Shield className="h-3.5 w-3.5 text-emerald-600" />
            <span>Security</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("customization")}
            className={`flex-1 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "customization"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Palette className="h-3.5 w-3.5 text-blue-600" />
            <span>Customization</span>
          </button>
        </div>
      </div>

      {/* Settings Scrollable Content */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 pb-16">
        {activeTab === "security" ? (
          <>
            {/* Encryption Status Line */}
            <div className="px-4 py-4 flex items-center justify-between">
              <div>
                <div className="text-[15px] font-medium text-slate-900">
                  End-to-End Encryption
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  ECDH P-256 + AES-256-GCM Zero-Knowledge
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-600 font-medium text-xs bg-emerald-50 px-2.5 py-1 rounded-full">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Active</span>
              </div>
            </div>

            {/* Disappearing Messages Setting */}
            <div className="px-4 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[15px] font-medium text-slate-900">
                    Disappearing Messages
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Automatically erase messages after time expires
                  </div>
                </div>
                <span className="text-xs font-semibold text-[#007aff]">
                  {settings.disappearingTimer === 0 ? "Off" : `${settings.disappearingTimer}s`}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-2 pt-1">
                {presets.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => triggerUpdate({ disappearingTimer: p.value })}
                    className={`py-2 text-xs font-medium rounded-xl border text-center transition-all cursor-pointer ${
                      settings.disappearingTimer === p.value
                        ? "bg-[#007aff] text-white border-[#007aff]"
                        : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Inactivity Passcode Lock */}
            <div className="px-4 py-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[15px] font-medium text-slate-900">
                    App Passcode Lock
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Require PIN after 60s of inactivity
                  </div>
                </div>
                <Switch
                  checked={settings.appLockEnabled}
                  onCheckedChange={(checked) => triggerUpdate({ appLockEnabled: checked })}
                />
              </div>

              {settings.appLockEnabled && (
                <div className="pt-2 flex items-center justify-between">
                  <span className="text-xs text-slate-600 font-medium">4-Digit Security PIN</span>
                  <input
                    type="password"
                    maxLength={4}
                    value={pinInput}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      setPinInput(val);
                      if (val.length === 4) {
                        triggerUpdate({ appLockPin: val });
                      }
                    }}
                    placeholder="1234"
                    className="w-20 px-2 py-1 text-center font-mono font-bold tracking-widest text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#007aff]"
                  />
                </div>
              )}
            </div>

            {/* Privacy Curtain */}
            <div className="px-4 py-4 flex items-center justify-between">
              <div>
                <div className="text-[15px] font-medium text-slate-900">
                  Privacy Curtain
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Auto-blur chat on app switch
                </div>
              </div>
              <Switch
                checked={settings.privacyCurtain}
                onCheckedChange={(checked) => triggerUpdate({ privacyCurtain: checked })}
              />
            </div>

            {/* Safety Numbers */}
            <button
              onClick={onOpenSafetyNumbers}
              className="w-full px-4 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <div>
                <div className="text-[15px] font-medium text-slate-900">
                  Verify Safety Numbers
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Confirm 60-digit cryptographic fingerprints
                </div>
              </div>
              <KeyRound className="h-4 w-4 text-slate-400" />
            </button>

            {/* Emergency Wipe */}
            <div className="p-4">
              {!showWipeDialog ? (
                <button
                  onClick={() => setShowWipeDialog(true)}
                  className="w-full py-3 rounded-2xl bg-rose-50 text-rose-600 font-semibold text-sm hover:bg-rose-100 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <Flame className="h-4 w-4" />
                  <span>Wipe All Local Data</span>
                </button>
              ) : (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl space-y-3">
                  <p className="text-xs text-rose-700 font-semibold text-center leading-relaxed">
                    Permanently delete all cryptographic keys and message history?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowWipeDialog(false)}
                      className="flex-1 py-2 rounded-xl bg-white text-slate-700 text-xs font-semibold cursor-pointer border border-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        onEmergencyWipe();
                        onBack();
                      }}
                      className="flex-1 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 cursor-pointer"
                    >
                      Confirm Wipe
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Customization: Theme Colors */}
            <div className="px-4 py-4 space-y-3">
              <div className="text-[15px] font-medium text-slate-900">
                Theme Color
              </div>
              <div className="grid grid-cols-6 gap-2">
                {themeColors.map((color) => {
                  const isSelected = (settings.themeColor || "blue") === color.id;
                  return (
                    <button
                      key={color.id}
                      onClick={() => triggerUpdate({ themeColor: color.id })}
                      className={`h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer ${color.bgClass} ${
                        isSelected ? "ring-3 ring-offset-2 ring-slate-800 scale-105" : ""
                      }`}
                    >
                      {isSelected && <Check className="h-4 w-4 text-white stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Customization: Wallpaper */}
            <div className="px-4 py-4 space-y-2.5">
              <div className="text-[15px] font-medium text-slate-900">
                Chat Canvas Style
              </div>
              <div className="grid grid-cols-2 gap-2">
                {wallpapers.map((wp) => {
                  const isSelected = (settings.chatWallpaper || "default") === wp.id;
                  return (
                    <button
                      key={wp.id}
                      onClick={() => triggerUpdate({ chatWallpaper: wp.id })}
                      className={`p-2.5 rounded-xl text-left border text-xs font-medium transition-all cursor-pointer ${
                        isSelected
                          ? "bg-slate-900 text-white border-slate-900"
                          : "bg-white text-slate-700 border-slate-200"
                      }`}
                    >
                      {wp.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Customization: Font Size */}
            <div className="px-4 py-4 space-y-2.5">
              <div className="text-[15px] font-medium text-slate-900">
                Font Size
              </div>
              <div className="grid grid-cols-3 gap-2">
                {fontSizes.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => triggerUpdate({ fontSize: f.id })}
                    className={`py-2 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                      (settings.fontSize || "medium") === f.id
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-700 border-slate-200"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Customization: Bubble Style */}
            <div className="px-4 py-4 space-y-2.5">
              <div className="text-[15px] font-medium text-slate-900">
                Message Bubble Corner
              </div>
              <div className="grid grid-cols-3 gap-2">
                {bubbleStyles.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => triggerUpdate({ bubbleStyle: b.id })}
                    className={`py-2 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                      (settings.bubbleStyle || "modern") === b.id
                        ? "bg-slate-900 text-white border-slate-900"
                        : "bg-white text-slate-700 border-slate-200"
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Customization: Enter to Send */}
            <div className="px-4 py-4 flex items-center justify-between">
              <div>
                <div className="text-[15px] font-medium text-slate-900">
                  Enter Key to Send
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Pressing Enter sends message
                </div>
              </div>
              <Switch
                checked={settings.enterToSend ?? true}
                onCheckedChange={(checked) => triggerUpdate({ enterToSend: checked })}
              />
            </div>

            {/* Customization: Sound Effects */}
            <div className="px-4 py-4 flex items-center justify-between">
              <div>
                <div className="text-[15px] font-medium text-slate-900">
                  Audio Feedback
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Synthetic pop sounds on send & receive
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => soundManager.playSend()}
                  className="text-xs font-semibold text-[#007aff] underline cursor-pointer"
                >
                  Test
                </button>
                <Switch
                  checked={settings.soundEffects ?? true}
                  onCheckedChange={(checked) => triggerUpdate({ soundEffects: checked })}
                />
              </div>
            </div>

            {/* Customization: Read Receipts */}
            <div className="px-4 py-4 flex items-center justify-between">
              <div>
                <div className="text-[15px] font-medium text-slate-900">
                  Read Receipts
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Show delivery checkmarks
                </div>
              </div>
              <Switch
                checked={settings.readReceipts ?? true}
                onCheckedChange={(checked) => triggerUpdate({ readReceipts: checked })}
              />
            </div>
          </>
        )}
      </div>

      {/* Save Notification Footer */}
      <footer className="h-10 px-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 shrink-0">
        <span className="flex items-center gap-1.5">
          {savedBadge ? (
            <span className="text-emerald-600 font-semibold flex items-center gap-1">
              <Check className="h-3 w-3" />
              Settings saved!
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-slate-400" />
              Auto-saved to device
            </span>
          )}
        </span>
        <span className="text-[11px] font-mono text-slate-400">E2EE v2.0</span>
      </footer>
    </div>
  );
}
