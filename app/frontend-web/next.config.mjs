/** @type {import('next').NextConfig} */
const backendUrl =
  process.env.BACKEND_INTERNAL_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  'http://localhost:8080';

const isDev = process.env.NODE_ENV !== 'production';

const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || (isDev ? '.next_dev' : '.next'),
  ...(isDev ? {} : { output: 'standalone' }),
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/logout',
        destination: `${backendUrl}/logout`,
      },
      {
        source: '/oauth2/:path*',
        destination: `${backendUrl}/oauth2/:path*`,
      },
    ];
  },
};

export default nextConfig;
