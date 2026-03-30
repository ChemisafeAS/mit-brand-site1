import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  async headers() {
    return [
      {
        source: "/ekatalog/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noimageindex, nosnippet",
          },
        ],
      },
      {
        source: "/download/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noimageindex, nosnippet",
          },
          {
            key: "Content-Disposition",
            value: "attachment",
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/download/:path*",
        destination: "/ekatalog/:path*",
      },
    ];
  },
};

export default nextConfig;
