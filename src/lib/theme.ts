import { ThemeColor, ChatWallpaper, FontSize, BubbleStyle } from "@/types/chat";

export function getThemeClasses(theme: ThemeColor = "blue") {
  switch (theme) {
    case "emerald":
      return {
        bg: "bg-[#00a884]",
        hoverBg: "hover:bg-[#008f6f]",
        text: "text-[#00a884]",
        border: "border-[#00a884]",
        ring: "focus-within:border-[#00a884] focus-within:ring-[#00a884]/20",
        bubbleOutgoing: "bg-[#00a884] text-white shadow-xs",
        bubbleCard: "bg-[#008f6f] border-emerald-400 text-white",
        subtle: "text-emerald-100",
        accentHex: "#00a884",
      };
    case "slate":
      return {
        bg: "bg-[#050505]",
        hoverBg: "hover:bg-[#1c1e21]",
        text: "text-[#050505]",
        border: "border-[#050505]",
        ring: "focus-within:border-[#050505] focus-within:ring-[#050505]/20",
        bubbleOutgoing: "bg-[#050505] text-white shadow-xs",
        bubbleCard: "bg-[#1c1e21] border-[#303030] text-white",
        subtle: "text-slate-300",
        accentHex: "#050505",
      };
    case "purple":
      return {
        bg: "bg-gradient-to-r from-[#7c3aed] to-[#d946ef]",
        hoverBg: "hover:opacity-90",
        text: "text-[#7c3aed]",
        border: "border-[#7c3aed]",
        ring: "focus-within:border-[#7c3aed] focus-within:ring-[#7c3aed]/20",
        bubbleOutgoing: "bg-gradient-to-r from-[#7c3aed] to-[#d946ef] text-white shadow-xs",
        bubbleCard: "bg-purple-800/80 border-purple-400 text-white",
        subtle: "text-purple-100",
        accentHex: "#7c3aed",
      };
    case "rose":
      return {
        bg: "bg-gradient-to-r from-[#e11d48] to-[#f43f5e]",
        hoverBg: "hover:opacity-90",
        text: "text-[#e11d48]",
        border: "border-[#e11d48]",
        ring: "focus-within:border-[#e11d48] focus-within:ring-[#e11d48]/20",
        bubbleOutgoing: "bg-gradient-to-r from-[#e11d48] to-[#f43f5e] text-white shadow-xs",
        bubbleCard: "bg-rose-800/80 border-rose-400 text-white",
        subtle: "text-rose-100",
        accentHex: "#e11d48",
      };
    case "amber":
      return {
        bg: "bg-[#d97706]",
        hoverBg: "hover:bg-[#b45309]",
        text: "text-[#d97706]",
        border: "border-[#d97706]",
        ring: "focus-within:border-[#d97706] focus-within:ring-[#d97706]/20",
        bubbleOutgoing: "bg-[#d97706] text-white shadow-xs",
        bubbleCard: "bg-amber-800/80 border-amber-400 text-white",
        subtle: "text-amber-100",
        accentHex: "#d97706",
      };
    case "blue":
    default:
      return {
        bg: "bg-[#0084ff]",
        hoverBg: "hover:bg-[#0073e6]",
        text: "text-[#0084ff]",
        border: "border-[#0084ff]",
        ring: "focus-within:border-[#0084ff] focus-within:ring-[#0084ff]/20",
        bubbleOutgoing: "bg-[#0084ff] text-white shadow-xs",
        bubbleCard: "bg-blue-600/90 border-blue-400 text-white",
        subtle: "text-blue-100",
        accentHex: "#0084ff",
      };
  }
}

export function getWallpaperClass(wallpaper: ChatWallpaper = "default"): string {
  switch (wallpaper) {
    case "dots":
      return "bg-white bg-[radial-gradient(#e4e6eb_1.5px,transparent_1.5px)] [background-size:20px_20px]";
    case "grid":
      return "bg-white bg-[linear-gradient(to_right,#f0f2f5_1px,transparent_1px),linear-gradient(to_bottom,#f0f2f5_1px,transparent_1px)] [background-size:24px_24px]";
    case "warm":
      return "bg-[#faf9f6]";
    case "dark":
      return "bg-[#18191a] text-[#e4e6eb]";
    case "default":
    default:
      return "bg-white";
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
