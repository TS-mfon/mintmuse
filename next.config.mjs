/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // ESLint is run separately in CI; don't block `vercel build` on style warnings
  eslint: { ignoreDuringBuilds: true },
  webpack: (config) => {
    // wagmi/viem reference some node built-ins we don't need in the browser
    config.resolve.fallback = { fs: false, net: false, tls: false };
    return config;
  },
};

export default nextConfig;
