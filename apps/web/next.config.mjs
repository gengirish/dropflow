/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@dropflow/db", "@dropflow/types", "@dropflow/gst", "@dropflow/config"],
};

export default nextConfig;
