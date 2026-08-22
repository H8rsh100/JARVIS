/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@jarvis/agent"],
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@x402/svm": false,
      "@x402/svm/exact/client": false,
      "@x402/evm/upto/client": false,
      "pino-pretty": false,
    };
    return config;
  },
};

module.exports = nextConfig;
