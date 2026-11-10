import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Talk Together",
    short_name: "TalkTogether",
    description: "Zero-knowledge encrypted messenger",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0084ff",
    icons: [
      {
        src: "/favicon.png",
        sizes: "256x256",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/logo.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
