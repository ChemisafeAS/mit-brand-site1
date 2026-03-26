import Image from "next/image";

export default function OmPage() {
  return (
    <main
      style={{
        maxWidth: "1280px",
        margin: "0 auto",
        padding: "56px 32px 80px 32px",
      }}
    >
      <section
        style={{
          background:
            "linear-gradient(135deg, #0f172a 0%, #1e293b 55%, #334155 100%)",
          color: "white",
          borderRadius: "32px",
          padding: "48px",
          boxShadow: "0 22px 60px rgba(15, 23, 42, 0.18)",
          marginBottom: "28px",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "clamp(42px, 7vw, 72px)",
            lineHeight: 0.95,
          }}
        >
          Chemisafe A/S
        </h1>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(280px, 0.8fr)",
          gap: "24px",
          alignItems: "start",
          marginBottom: "28px",
        }}
      >
        <article
          style={{
            backgroundColor: "white",
            borderRadius: "24px",
            padding: "32px",
            boxShadow: "0 14px 40px rgba(15, 23, 42, 0.08)",
            border: "1px solid rgba(148, 163, 184, 0.14)",
          }}
        >
          <h2 style={{ margin: "0 0 18px 0", fontSize: "32px", color: "#0f172a" }}>
            Stabil levering og mange års erfaring
          </h2>

          <p
            style={{
              margin: "0 0 18px 0",
              fontSize: "18px",
              lineHeight: 1.8,
              color: "#475569",
            }}
          >
            Chemisafe har været i branchen i mere end 25 år og leverer
            saltprodukter til både erhverv og private.
          </p>

          <p
            style={{
              margin: "0 0 18px 0",
              fontSize: "18px",
              lineHeight: 1.8,
              color: "#475569",
            }}
          >
            Vi lægger vægt på stabile leverancer, hurtig ordrebehandling og en
            praktisk tilgang til kundernes behov.
          </p>

          <p
            style={{
              margin: 0,
              fontSize: "18px",
              lineHeight: 1.8,
              color: "#475569",
            }}
          >
            På området for vejsalt er vi blandt de førende leverandører til det
            offentlige.
          </p>
        </article>

        <aside
          style={{
            borderRadius: "24px",
            overflow: "hidden",
            boxShadow: "0 14px 40px rgba(15, 23, 42, 0.08)",
            border: "1px solid rgba(148, 163, 184, 0.14)",
            minHeight: "100%",
            position: "relative",
          }}
        >
          <Image
            src="/om-lager.png"
            alt="Læssemaskine og lastbiler i saltlager"
            width={1152}
            height={768}
            style={{
              width: "100%",
              height: "100%",
              minHeight: "100%",
              objectFit: "cover",
              objectPosition: "center",
              display: "block",
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(15,23,42,0.06) 0%, rgba(15,23,42,0.16) 100%)",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: "24px",
              right: "24px",
              bottom: "24px",
              backgroundColor: "rgba(15,23,42,0.74)",
              color: "white",
              borderRadius: "18px",
              padding: "18px 20px",
              backdropFilter: "blur(6px)",
            }}
          >
            <p style={{ margin: "0 0 6px 0", fontWeight: 700 }}>
              Levering og logistik
            </p>
            <p
              style={{
                margin: 0,
                lineHeight: 1.6,
                color: "rgba(255,255,255,0.88)",
              }}
            >
              Vi arbejder med fokus på håndtering, 
              ordreflow og levering af saltprodukter til både professionelle kunder og private.
              
            </p>
          </div>
        </aside>
      </section>

      <section
        style={{
          backgroundColor: "white",
          borderRadius: "24px",
          padding: "32px",
          boxShadow: "0 14px 40px rgba(15, 23, 42, 0.08)",
          border: "1px solid rgba(148, 163, 184, 0.14)",
        }}
      >
        <h2 style={{ margin: "0 0 18px 0", fontSize: "32px", color: "#0f172a" }}>
          Derfor vælger kunder Chemisafe A/S
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "20px",
          }}
        >
          <div>
            <p style={{ margin: "0 0 8px 0", fontWeight: 700, color: "#0f172a" }}>
              Stabil levering
            </p>
            <p style={{ margin: 0, color: "#475569", lineHeight: 1.7 }}>
              Vi lægger vægt på leveringssikkerhed og en løsning, der fungerer i
              praksis.
            </p>
          </div>

          <div>
            <p style={{ margin: "0 0 8px 0", fontWeight: 700, color: "#0f172a" }}>
              Hurtig ordrebehandling
            </p>
            <p style={{ margin: 0, color: "#475569", lineHeight: 1.7 }}>
              Forespørgsler og bestillinger håndteres hurtigt og direkte.
            </p>
          </div>

          <div>
            <p style={{ margin: "0 0 8px 0", fontWeight: 700, color: "#0f172a" }}>
              Produkter til flere behov
            </p>
            <p style={{ margin: 0, color: "#475569", lineHeight: 1.7 }}>
              Vi leverer både til erhverv, det offentlige og private kunder.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
