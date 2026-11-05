import { ThemeColor, ChatWallpaper, FontSize, BubbleStyle } from "@/types/chat";

export function getThemeClasses(theme: ThemeColor = "blue") {
  switch (theme) {
    case "emerald":
      return {
        bg: "bg-[#07c160]",
        hoverBg: "hover:bg-emerald-600",
        text: "text-[#07c160]",
        border: "border-[#07c160]",
        ring: "focus-within:border-[#07c160] focus-within:ring-[#07c160]/20",
        bubbleOutgoing: "bg-[#07c160] text-white",
        bubbleCard: "bg-emerald-700/40 border-emerald-400/30 text-white",
        subtle: "text-emerald-100",
        accentHex: "#07c160",
      };
    case "slate":
      return {
        bg: "bg-slate-900",
        hoverBg: "hover:bg-slate-800",
        text: "text-slate-900",
        border: "border-slate-900",
        ring: "focus-within:border-slate-900 focus-within:ring-slate-900/20",
        bubbleOutgoing: "bg-slate-900 text-white",
        bubbleCard: "bg-slate-800/80 border-slate-700 text-white",
        subtle: "text-slate-300",
        accentHex: "#0f172a",
      };
    case "purple":
      return {
        bg: "bg-purple-600",
        hoverBg: "hover:bg-purple-700",
        text: "text-purple-600",
        border: "border-purple-600",
        ring: "focus-within:border-purple-600 focus-within:ring-purple-600/20",
        bubbleOutgoing: "bg-purple-600 text-white",
        bubbleCard: "bg-purple-700/40 border-purple-400/30 text-white",
        subtle: "text-purple-100",
        accentHex: "#9333ea",
      };
    case "rose":
      return {
        bg: "bg-rose-500",
        hoverBg: "hover:bg-rose-600",
        text: "text-rose-500",
        border: "border-rose-500",
        ring: "focus-within:border-rose-500 focus-within:ring-rose-500/20",
        bubbleOutgoing: "bg-rose-500 text-white",
        bubbleCard: "bg-rose-700/40 border-rose-400/30 text-white",
        subtle: "text-rose-100",
        accentHex: "#f43f5e",
      };
    case "amber":
      return {
        bg: "bg-amber-500",
        hoverBg: "hover:bg-amber-600",
        text: "text-amber-500",
        border: "border-amber-500",
        ring: "focus-within:border-amber-500 focus-within:ring-amber-500/20",
        bubbleOutgoing: "bg-amber-500 text-white",
        bubbleCard: "bg-amber-700/40 border-amber-400/30 text-white",
        subtle: "text-amber-100",
        accentHex: "#f59e0b",
      };
    case "blue":
    default:
      return {
        bg: "bg-[#007aff]",
        hoverBg: "hover:bg-blue-600",
        text: "text-[#007aff]",
        border: "border-[#007aff]",
        ring: "focus-within:border-[#007aff] focus-within:ring-[#007aff]/20",
        bubbleOutgoing: "bg-[#007aff] text-white",
        bubbleCard: "bg-blue-700/40 border-blue-400/30 text-white",
        subtle: "text-blue-100",
        accentHex: "#007aff",
      };
  }
}

export function getWallpaperClass(wallpaper: ChatWallpaper = "default"): string {
  switch (wallpaper) {
    case "dots":
      return "bg-[#f8f9fa] bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px]";
    case "grid":
      return "bg-[#f8f9fa] bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] [background-size:24px_24px]";
    case "warm":
      return "bg-[#fbf9f5]";
    case "dark":
      return "bg-[#0f172a] text-slate-100";
    case "default":
    default:
      return "bg-[#f8f9fa]";
  }
}

export function getFontSizeClass(size: FontSize = "medium"): string {
  switch (size) {
    case "small":
      return "text-xs";
    case "large":
      return "text-base";
    case "medium":
    default:
      return "text-sm";
  }
}

export function getBubbleRadius(style: BubbleStyle = "modern", isMe: boolean): string {
  switch (style) {
    case "pill":
      return "rounded-3xl";
    case "compact":
      return "rounded-lg";
    case "modern":
    default:
      return `rounded-2xl ${isMe ? "rounded-br-sm" : "rounded-bl-sm"}`;
  }
}
