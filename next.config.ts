import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* The InfraSet Python engine is spawned at runtime (child_process), not
     imported by Node, so the file tracer only picks up infraset_engine.py.
     Force-include the whole engine folder in the standalone bundle. */
  outputFileTracingIncludes: {
    "/api/infraset/match": ["./engine/**"],
    "/api/infraset/calculate": ["./engine/**"],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
