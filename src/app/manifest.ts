import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MarkFlow — Marking, on rails",
    short_name: "MarkFlow",
    description:
      "The teacher's marking rhythm. Plan formative checks so you never mark two classes at once and never miss a two-week feedback window.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f6f3ec",
    theme_color: "#d9481f",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
