import Link from "next/link";

export default function Home() {
  return (
    <main>
      <h1 style={{ fontSize: "48px", marginBottom: "20px" }}>
        Velkommen til min hjemmeside
      </h1>

      <p style={{ fontSize: "20px", lineHeight: "1.6", marginBottom: "20px" }}>
        Jeg er i gang med at bygge min første hjemmeside med Next.js.
      </p>

      <p style={{ fontSize: "18px", lineHeight: "1.6", marginBottom: "30px" }}>
        Senere vil siden blive lagt på GitHub, deployet med Vercel og koblet på
        Supabase.
      </p>

      <Link
        href="/kontakt"
        style={{
          display: "inline-block",
          padding: "12px 20px",
          backgroundColor: "black",
          color: "white",
          textDecoration: "none",
          borderRadius: "8px",
        }}
      >
        Kontakt mig
      </Link>
    </main>
  );
}