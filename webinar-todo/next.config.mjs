/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // ESLint is optional for this app; don't block production builds on it.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
