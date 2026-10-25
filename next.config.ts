import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the Next.js development badge; compile and runtime errors are still shown.
  devIndicators: false,
  // Loaded with plain Node require: PGlite ships WebAssembly files and ws has optional native add-ons.
  serverExternalPackages: ["@electric-sql/pglite", "ws"],
  // Every page here depends on the signed-in candidate, so pages render per request.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
