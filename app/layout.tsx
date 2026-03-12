import "./globals.css";
import Nav from "@/components/Nav";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="da">
      <body>
        <Nav />

        {children}

        <footer
          style={{
            background: "#0f172a",
            color: "white",
            marginTop: "80px",
            padding: "60px 40px",
          }}
        >
          <div
            style={{
              maxWidth: "1400px",
              margin: "0 auto",
            }}
          >
            <h2
              style={{
                fontSize: "36px",
                marginBottom: "40px",
                color: "#38bdf8",
              }}
            >
              Contact info
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "40px",
                marginBottom: "40px",
              }}
            >
              <div>
                <h3 style={{ marginBottom: "10px" }}>Chemisafe A/S</h3>

                <p style={{ lineHeight: "1.7" }}>
                  H P Christensens Vej 1, 1.
                  <br />
                  3000 Helsingør
                </p>

                <p>
                  <a
                    href="mailto:ordre@chemisafe.dk"
                    style={{
                      color: "white",
                      textDecoration: "underline",
                    }}
                  >
                    Send e-mail
                  </a>
                </p>

                <p>
                  <a
                    href="tel:+4586447900"
                    style={{
                      color: "white",
                      textDecoration: "underline",
                    }}
                  >
                    +45 86 44 79 00
                  </a>
                </p>
              </div>

              <div>
                <h3 style={{ marginBottom: "10px" }}>Produkter</h3>

                <p>Vejsalt</p>
                <p>Fodersalt</p>
                <p>Saltpoletter</p>
                <p>Øvrige saltprodukter</p>
              </div>

              <div>
                <h3 style={{ marginBottom: "10px" }}>Kontakt</h3>

                <p>
                  Kontakt os for tilbud eller information om vores produkter.
                </p>

                <p>
                  <a
                    href="/kontakt"
                    style={{
                      color: "#7ce3d7",
                      fontWeight: "bold",
                    }}
                  >
                    Gå til kontakt →
                  </a>
                </p>
              </div>
            </div>

            <div
              style={{
                borderTop: "1px solid rgba(255,255,255,0.15)",
                paddingTop: "20px",
                display: "flex",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "10px",
                fontSize: "14px",
                opacity: 0.85,
              }}
            >
              <p>© {new Date().getFullYear()} Chemisafe A/S</p>

              <p>Leverandør af saltprodukter til erhverv</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}