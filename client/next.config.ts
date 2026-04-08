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
    ],
    // Allow common storage/profile image hosts used by Firebase and Cloudinary
    domains: [
      'lh3.googleusercontent.com',
      'res.cloudinary.com',
      'firebasestorage.googleapis.com',
      'storage.googleapis.com',
      'bharat-museum-tickets.firebasestorage.app',
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
}

export default nextConfig
