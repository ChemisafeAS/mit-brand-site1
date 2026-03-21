const baseUrl =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://chemisafe.dk";

const routes = [
  { path: "/", changeFrequency: "weekly", priority: "1.0" },
  { path: "/produkter", changeFrequency: "weekly", priority: "0.9" },
  { path: "/om", changeFrequency: "monthly", priority: "0.7" },
  { path: "/kontakt", changeFrequency: "monthly", priority: "0.8" },
];

export async function GET() {
  const lastModified = new Date().toISOString();

  const urls = routes
    .map(
      (route) => `\
<url>
  <loc>${baseUrl}${route.path}</loc>
  <lastmod>${lastModified}</lastmod>
  <changefreq>${route.changeFrequency}</changefreq>
  <priority>${route.priority}</priority>
</url>`
    )
    .join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
