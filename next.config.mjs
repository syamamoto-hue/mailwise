/** @type {import('next').NextConfig} */
const nextConfig = {
  // libSQL クライアントはサーバ側でそのまま require させる（バンドルしない）
  experimental: {
    serverComponentsExternalPackages: ["@libsql/client", "libsql"],
  },
};

export default nextConfig;
