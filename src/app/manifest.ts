import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ResaleOS",
    short_name: "ResaleOS",
    description: "Pilotage local de l’achat-revente de seconde main.",
    start_url: "/",
    display: "standalone",
    background_color: "#090c0b",
    theme_color: "#c9f36a",
    lang: "fr",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
