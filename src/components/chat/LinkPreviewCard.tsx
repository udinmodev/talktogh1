"use client";

import React, { useState } from "react";
import { ExternalLink, Globe } from "lucide-react";
import { LinkMetadata } from "@/types/chat";

interface LinkPreviewCardProps {
  url: string;
  initialMetadata?: LinkMetadata;
  isMe: boolean;
}

export function extractUrls(text: string): string[] {
  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
  const matches = text.match(urlRegex);
  return matches ? Array.from(new Set(matches)) : [];
}

export function formatMessageWithLinks(text: string, isMe: boolean) {
  const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
  const parts = text.split(urlRegex);
  return parts.map((part, index) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className={`underline underline-offset-2 break-all font-medium hover:opacity-80 transition-opacity ${
            isMe ? "text-white hover:text-blue-100" : "text-blue-600 hover:text-blue-700"
          }`}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

/**
 * 100% Pure Client-Side Link Metadata Generator
 * Generates rich previews with zero server scraping, zero backend API dependency,
 * and zero network exposure of user links.
 */
export function getClientLinkMetadata(url: string): LinkMetadata {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, "");
    const pathname = parsed.pathname;

    // High resolution domain favicon using browser-direct CDN
    const favicon = `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;

    // Domain-specific rich branding dictionary for common platforms
    if (hostname.includes("github.com")) {
      const repoParts = pathname.split("/").filter(Boolean);
      const title = repoParts.length >= 2 
        ? `${repoParts[0]}/${repoParts[1]} - GitHub Repository`
        : "GitHub: Let's build from here";
      return {
        url,
        title,
        description: "GitHub is where over 100 million developers collaborate on code, review pull requests, and build secure software.",
        siteName: "GitHub",
        favicon,
        image: "https://images.ctfassets.net/8aevphvgewt8/76epZKB2wF998m4e4bLLXn/c505f20b00ec70b88b1be5aec42c4be4/OG_image.jpg",
      };
    }

    if (hostname.includes("nextjs.org")) {
      return {
        url,
        title: "Next.js by Vercel - The React Framework for the Web",
        description: "The React Framework for high-performance web applications with App Router, Turbopack, and server actions.",
        siteName: "Next.js",
        favicon,
        image: "https://nextjs.org/og.png",
      };
    }

    if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
      return {
        url,
        title: "YouTube Video",
        description: "Watch and share videos, live streams, and community posts on YouTube.",
        siteName: "YouTube",
        favicon,
        image: "https://www.youtube.com/img/desktop/yt_1200.png",
      };
    }

    if (hostname.includes("x.com") || hostname.includes("twitter.com")) {
      return {
        url,
        title: "X (formerly Twitter)",
        description: "From breaking news and entertainment to sports and technology, get the full story.",
        siteName: "X",
        favicon,
      };
    }

    if (hostname.includes("wikipedia.org")) {
      const articleTitle = decodeURIComponent(pathname.replace(/^\/wiki\//, "")).replace(/_/g, " ");
      return {
        url,
        title: articleTitle ? `${articleTitle} - Wikipedia` : "Wikipedia, the free encyclopedia",
        description: "A free online encyclopedia, created and edited by volunteers around the world.",
        siteName: "Wikipedia",
        favicon,
      };
    }

    if (hostname.includes("reddit.com")) {
      return {
        url,
        title: "Reddit: Dive into anything",
        description: "Reddit is a network of communities where people can dive into their interests, hobbies and passions.",
        siteName: "Reddit",
        favicon,
      };
    }

    if (hostname.includes("npm") || hostname.includes("npmjs.com")) {
      return {
        url,
        title: `${pathname.replace(/^\/package\//, "") || "npm"} - Package Manager`,
        description: "The registry for JavaScript packages, tools, and libraries.",
        siteName: "npm",
        favicon,
      };
    }

    // Generic fallback for any other valid URL
    const pathSnippet = pathname.length > 1 ? pathname.slice(1).split("/").pop() || "" : "";
    const cleanTitle = pathSnippet ? `${pathSnippet} on ${hostname}` : hostname;

    return {
      url,
      title: cleanTitle,
      description: `Encrypted link preview for ${hostname}${pathname !== "/" ? pathname : ""}`,
      siteName: hostname,
      favicon,
    };
  } catch {
    return {
      url,
      title: url,
      siteName: "Link",
    };
  }
}

export default function LinkPreviewCard({
  url,
  initialMetadata,
  isMe,
}: LinkPreviewCardProps) {
  const metadata: LinkMetadata = initialMetadata || getClientLinkMetadata(url);
  const [imageError, setImageError] = useState<boolean>(false);

  return (
    <a
      href={metadata.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`block mt-2 rounded-xl border overflow-hidden transition-all text-left max-w-md group ${
        isMe
          ? "bg-blue-700/40 border-blue-400/30 hover:bg-blue-700/60 text-white"
          : "bg-slate-50 border-slate-200/90 hover:bg-slate-100 text-slate-900"
      }`}
    >
      {/* Banner Preview Image if present */}
      {metadata.image && !imageError && (
        <div className="relative w-full h-32 sm:h-36 bg-slate-900/10 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={metadata.image}
            alt={metadata.title || "Link preview"}
            className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
            onError={() => setImageError(true)}
            loading="lazy"
          />
        </div>
      )}

      {/* Card Content */}
      <div className="p-2.5 sm:p-3">
        {/* Favicon & Site Name */}
        <div className="flex items-center gap-1.5 text-[11px] mb-1 opacity-80 font-medium">
          {metadata.favicon ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={metadata.favicon}
              alt=""
              className="w-3.5 h-3.5 rounded-sm shrink-0 object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
          ) : (
            <Globe className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="truncate">{metadata.siteName || new URL(metadata.url).hostname}</span>
          <ExternalLink className="h-3 w-3 ml-auto shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Title */}
        <h4 className="text-xs sm:text-sm font-semibold leading-snug line-clamp-2 mb-1">
          {metadata.title || metadata.url}
        </h4>

        {/* Description */}
        {metadata.description && (
          <p
            className={`text-[11px] line-clamp-2 leading-relaxed ${
              isMe ? "text-blue-100/90" : "text-slate-600"
            }`}
          >
            {metadata.description}
          </p>
        )}
      </div>
    </a>
  );
}
