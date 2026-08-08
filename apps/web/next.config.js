/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@jarvis/agent", "@jarvis/chains"],
  experimental: {
    serverComponentsExternalPackages: ["openai"],
  },
};

module.exports = nextConfig;
