import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@dropflow/db", "@dropflow/types", "@dropflow/gst", "@dropflow/config"],
  experimental: {
    outputFileTracingRoot: resolve(__dirname, "../../"),
  },
};

export default nextConfig;
