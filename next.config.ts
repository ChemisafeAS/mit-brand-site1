import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    ];
  },
};

export default nextConfig;
