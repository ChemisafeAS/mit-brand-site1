import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        width: "100%",
        overflow: "hidden",
      }}
    >
      <Image
        src="/salt.jpg"
        alt="Salt produkter"
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
            "linear-gradient(90deg, rgba(15,23,42,0.88) 0%, rgba(15,23,42,0.72) 38%, rgba(15,23,42,0.18) 100%)",
          zIndex: 1,
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 2,
          maxWidth: "1440px",
          margin: "0 auto",
          padding: "110px 32px 80px 32px",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <section style={{ maxWidth: "760px", color: "white" }}>
          <p
            style={{
              margin: "0 0 16px 0",
              fontSize: "16px",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "1.8px",
              opacity: 0.9,
            }}
          >
            Leverandør af saltprodukter
          </p>

          <h1
            style={{
              fontSize: "clamp(52px, 8vw, 96px)",
              lineHeight: 0.95,
              margin: "0 0 24px 0",
              fontWeight: 700,
            }}
          >
            Saltprodukter til erhverv
          </h1>

          <p
            style={{
              fontSize: "22px",
              lineHeight: 1.7,
              margin: "0 0 34px 0",
              maxWidth: "720px",
              color: "rgba(255,255,255,0.92)",
            }}
          >
            Chemisafe A/S leverer vejsalt, fodersalt, saltpoletter og et bredt
            sortiment af øvrige saltprodukter til professionelle kunder. Kontakt
            os for tilbud, levering og den rigtige løsning til jeres behov.
          </p>

          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
            <Link
              href="/kontakt"
              style={{
                padding: "16px 24px",
                backgroundColor: "white",
                color: "#0f172a",
                borderRadius: "999px",
                fontWeight: "bold",
                fontSize: "18px",
              }}
            >
              Få et tilbud
            </Link>

            <Link
              href="/om"
              style={{
                padding: "16px 24px",
                border: "1px solid rgba(255,255,255,0.7)",
                borderRadius: "999px",
                color: "white",
                fontWeight: "bold",
                fontSize: "18px",
                backgroundColor: "rgba(255,255,255,0.08)",
              }}
            >
              Læs mere
            </Link>
          </div>
        </section>

        <section
          style={{
            marginTop: "70px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: "20px",
            maxWidth: "1100px",
          }}
        >
          <div
            style={{
              backgroundColor: "rgba(255,255,255,0.92)",
              padding: "30px",
              borderRadius: "24px",
              color: "#0f172a",
              boxShadow: "0 12px 30px rgba(0,0,0,0.14)",
            }}
          >
            <h3 style={{ marginBottom: "12px", fontSize: "26px" }}>
              Vejsalt
            </h3>
            <p style={{ color: "#475569", lineHeight: "1.7", margin: 0 }}>
              Løsninger til vinterbekæmpelse og glatførebekæmpelse.
            </p>
          </div>

          <div
            style={{
              backgroundColor: "rgba(255,255,255,0.92)",
              padding: "30px",
              borderRadius: "24px",
              color: "#0f172a",
              boxShadow: "0 12px 30px rgba(0,0,0,0.14)",
            }}
          >
            <h3 style={{ marginBottom: "12px", fontSize: "26px" }}>
              Fodersalt
            </h3>
            <p style={{ color: "#475569", lineHeight: "1.7", margin: 0 }}>
              Saltprodukter til landbrug og professionelle behov.
            </p>
          </div>

          <div
            style={{
              backgroundColor: "rgba(255,255,255,0.92)",
              padding: "30px",
              borderRadius: "24px",
              color: "#0f172a",
              boxShadow: "0 12px 30px rgba(0,0,0,0.14)",
            }}
          >
            <h3 style={{ marginBottom: "12px", fontSize: "26px" }}>
              Større sortiment
            </h3>
            <p style={{ color: "#475569", lineHeight: "1.7", margin: 0 }}>
              Vi leverer også øvrige saltprodukter og løsninger efter behov.
            </p>
          </div>
        </section>

        <footer
          style={{
            marginTop: "70px",
            color: "rgba(255,255,255,0.92)",
            fontSize: "16px",
            lineHeight: "1.8",
            maxWidth: "900px",
          }}
        >
          <p style={{ margin: "0 0 6px 0" }}>
            <strong>Chemisafe A/S</strong>
          </p>
          <p style={{ margin: "0 0 6px 0" }}>
            Leverandør af vejsalt, fodersalt, saltpoletter og andre
            saltprodukter
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