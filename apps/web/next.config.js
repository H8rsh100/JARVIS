/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@jarvis/agent", "@jarvis/chains"],
  serverExternalPackages: ["openai"],
};

module.exports = nextConfig;
