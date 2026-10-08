import type { NextConfig } from "next";
const config: NextConfig = {
  env: {
    NEXT_PUBLIC_APP_RELEASE:
      process.env.VERCEL_DEPLOYMENT_ID ||
      process.env.VERCEL_URL ||
      process.env.NEXT_PUBLIC_APP_RELEASE ||
      "local-development",
  },
  serverExternalPackages: ["@electric-sql/pglite"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};
export default config;
