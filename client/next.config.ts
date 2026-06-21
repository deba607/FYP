import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: 'bharat-museum-tickets.firebasestorage.app',
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  outputFileTracingIncludes: {
    '/api/ffmpeg-core': [
      './node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js',
      './node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm',
    ],
  },
}

export default nextConfig
