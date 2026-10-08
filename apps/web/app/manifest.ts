import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Fitness · Vaš prostor",
    short_name: "Fitness",
    lang: "bs",
    description: "Vaš trening, ishrana i stručna podrška.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f6f5ef",
    theme_color: "#233e35",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
