/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@jarvis/agent", "@jarvis/chains"],
  serverExternalPackages: ["openai"],
  webpack: (config) => {
    // Wagmi connector deps may still soft-resolve Coinbase x402 paths; stub them.
    config.resolve.alias = {
      ...config.resolve.alias,
      "@x402/svm": false,
      "@x402/svm/exact/client": false,
      "@x402/evm/upto/client": false,
    };
    return config;
  },
};

module.exports = nextConfig;
