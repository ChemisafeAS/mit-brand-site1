import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        borderRadius: "28px",
        overflow: "hidden",
      }}
    >
      <Image
        src="/salt.jpg"
        alt="Salt"
        fill
        style={{
          objectFit: "cover",
          zIndex: 0,
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg, rgba(15,23,42,0.72) 0%, rgba(15,23,42,0.82) 45%, rgba(15,23,42,0.9) 100%)",
          zIndex: 1,
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 2,
          padding: "80px 40px 40px 40px",
          color: "white",
        }}
      >
        <section style={{ maxWidth: "720px", marginBottom: "60px" }}>
          <p
            style={{
              margin: "0 0 14px 0",
              fontSize: "14px",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "1.4px",
              opacity: 0.9,
            }}
          >
            Chemisafe A/S
          </p>

          <h1
            style={{
              fontSize: "clamp(38px, 6vw, 60px)",
              margin: "0 0 20px 0",
              lineHeight: 1.05,
            }}
          >
            Saltprodukter til erhverv
          </h1>

          <p
            style={{
              fontSize: "20px",
              lineHeight: "1.7",
              margin: "0 0 30px 0",
              opacity: 0.95,
              maxWidth: "680px",
            }}
          >
            Chemisafe A/S leverer vejsalt, fodersalt, saltpoletter og andre
            saltprodukter til professionelle kunder. Kontakt os for tilbud eller
            mere information.
          </p>

          <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
            <Link
              href="/kontakt"
              style={{
                padding: "14px 22px",
                backgroundColor: "white",
                color: "#0f172a",
                borderRadius: "12px",
                fontWeight: "bold",
              }}
            >
              Få et tilbud
            </Link>

            <Link
              href="/om"
              style={{
                padding: "14px 22px",
                border: "1px solid rgba(255,255,255,0.8)",
                borderRadius: "12px",
                fontWeight: "bold",
                color: "white",
                backgroundColor: "rgba(255,255,255,0.08)",
              }}
            >
              Læs mere
            </Link>
          </div>
        </section>

        <section
  style={{
    marginBottom: "60px",
  }}
>
  <div style={{ maxWidth: "760px", marginBottom: "24px" }}>
    <h2
      style={{
        fontSize: "32px",
        margin: "0 0 14px 0",
        color: "white",
      }}
    >
      Produkter og løsninger
    </h2>

    <p
      style={{
        fontSize: "18px",
        lineHeight: "1.7",
        color: "rgba(255,255,255,0.92)",
        margin: 0,
      }}
    >
      Chemisafe A/S leverer et bredt sortiment af saltprodukter til
      professionelle kunder. Herunder ses et udvalg af de produkter og
      løsninger, vi kan hjælpe med.
    </p>
  </div>

  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      gap: "20px",
    }}
  >
    <div
      style={{
        backgroundColor: "rgba(255,255,255,0.92)",
        padding: "28px",
        borderRadius: "18px",
        color: "#0f172a",
        boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
      }}
    >
      <h3 style={{ marginBottom: "10px", fontSize: "22px" }}>Vejsalt</h3>
      <p style={{ color: "#475569", lineHeight: "1.7" }}>
        Løsninger til vinterbekæmpelse og glatførebekæmpelse.
      </p>
    </div>

    <div
      style={{
        backgroundColor: "rgba(255,255,255,0.92)",
        padding: "28px",
        borderRadius: "18px",
        color: "#0f172a",
        boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
      }}
    >
      <h3 style={{ marginBottom: "10px", fontSize: "22px" }}>Fodersalt</h3>
      <p style={{ color: "#475569", lineHeight: "1.7" }}>
        Saltprodukter til landbrug og professionelle behov.
      </p>
    </div>

    <div
      style={{
        backgroundColor: "rgba(255,255,255,0.92)",
        padding: "28px",
        borderRadius: "18px",
        color: "#0f172a",
        boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
      }}
    >
      <h3 style={{ marginBottom: "10px", fontSize: "22px" }}>Saltpoletter</h3>
      <p style={{ color: "#475569", lineHeight: "1.7" }}>
        Praktiske løsninger til anlæg og systemer.
      </p>
    </div>

    <div
      style={{
        backgroundColor: "rgba(255,255,255,0.92)",
        padding: "28px",
        borderRadius: "18px",
        color: "#0f172a",
        boxShadow: "0 10px 30px rgba(0,0,0,0.12)",
      }}
    >
      <h3 style={{ marginBottom: "10px", fontSize: "22px" }}>
        Øvrige saltprodukter
      </h3>
      <p style={{ color: "#475569", lineHeight: "1.7" }}>
        Vi leverer også andre saltprodukter afhængigt af behov og anvendelse.
      </p>
    </div>
  </div>

  <p
    style={{
      marginTop: "20px",
      fontSize: "16px",
      lineHeight: "1.7",
      color: "rgba(255,255,255,0.9)",
      maxWidth: "760px",
    }}
  >
    Søger du et bestemt produkt, en særlig leveringsform eller en løsning til en
    specifik anvendelse, er du altid velkommen til at kontakte os for et tilbud.
  </p>
</section>

        <footer
  style={{
    marginTop: "20px",
    paddingTop: "28px",
    borderTop: "1px solid rgba(255,255,255,0.25)",
    color: "rgba(255,255,255,0.92)",
    fontSize: "15px",
    lineHeight: "1.8",
  }}
>
  <p style={{ margin: "0 0 6px 0" }}>
    <strong>Chemisafe A/S</strong>
  </p>

  <p style={{ margin: "0 0 6px 0" }}>
    Leverandør af vejsalt, fodersalt, saltpoletter og andre saltprodukter
  </p>

  <p style={{ margin: "0 0 6px 0" }}>
    Telefon:{" "}
    <a
      href="tel:+4586447900"
      style={{ color: "white", textDecoration: "underline" }}
    >
      86 44 79 00
    </a>
  </p>

  <p style={{ margin: 0 }}>
    Email:{" "}
    <a
      href="mailto:ordre@chemisafe.dk"
      style={{ color: "white", textDecoration: "underline" }}
    >
      ordre@chemisafe.dk
    </a>
  </p>
</footer>
      </div>
    </main>
  );
}