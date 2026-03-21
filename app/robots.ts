import type { MetadataRoute } from "next";

const baseUrl =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://chemisafe.dk";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/ekatalog"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
