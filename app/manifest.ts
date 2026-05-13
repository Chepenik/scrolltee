import type { MetadataRoute } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "./seo";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    scope: "/",
    display: "fullscreen",
    background_color: "#87c7e8",
    theme_color: "#12321f",
    categories: ["games", "sports", "entertainment"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any"
      }
    ]
  };
}
