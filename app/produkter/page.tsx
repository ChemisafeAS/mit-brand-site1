const products = [
  {
    name: "Pingo vejsalt 25 kg. Sæk",
    saltType: "Vejsalt",
  },
  {
    name: "Pingo vejsalt 15 kg. Sæk",
    saltType: "Vejsalt",
  },
  {
    name: "Pingo vejsalt 10 kg. Sæk",
    saltType: "Vejsalt",
  },
  {
    name: "Pingo vejsalt 10 kg. Spande",
    saltType: "Vejsalt",
  },
  {
    name: "Pingo vejsalt bigbag 1000 kg.",
    saltType: "Vejsalt",
  },
  {
    name: "Pingo vejsalt bigbag 600 kg",
    saltType: "Vejsalt",
  },
  {
    name: "MagnesiumKlorid 25 kg sæk, flakes",
    saltType: "Magnesiumklorid",
  },
  {
    name: "Pingo-Produktionssalt, 20 kg",
    saltType: "Produktionssalt",
  },
  {
    name: "Urea 15 kg sæk",
    saltType: "Urea",
  },
  {
    name: "Calcium Cloride, 15 kg, Flakes",
    saltType: "Calciumchlorid",
  },
  {
    name: "Calcium Cloride, 15 kg Prills",
    saltType: "Calciumchlorid",
  },
  {
    name: "Løst pingo Stensalt, Vejsalt",
    saltType: "Vejsalt",
  },
  {
    name: "Løst Pingo Havsalt,",
    saltType: "Havsalt",
  },
];

export default function ProdukterPage() {
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
          marginBottom: "32px",
        }}
      >
        <p
          style={{
            margin: "0 0 14px 0",
            textTransform: "uppercase",
            letterSpacing: "1.8px",
            fontWeight: 700,
            fontSize: "14px",
            opacity: 0.82,
          }}
        >
          Produkter
        </p>

        <h1
          style={{
            margin: "0 0 18px 0",
            fontSize: "clamp(42px, 7vw, 72px)",
            lineHeight: 0.95,
          }}
        >
          Varebeskrivelse
        </h1>

        <p
          style={{
            margin: 0,
            maxWidth: "760px",
            fontSize: "20px",
            lineHeight: 1.7,
            color: "rgba(255,255,255,0.9)",
          }}
        >
          Oversigt over vores produkter med tilhørende salttype. Kontakt os for
          tilbud, levering og produktinformation.
        </p>
      </section>

      <section
        style={{
          backgroundColor: "white",
          borderRadius: "28px",
          boxShadow: "0 14px 40px rgba(15, 23, 42, 0.09)",
          border: "1px solid rgba(148, 163, 184, 0.16)",
          overflow: "hidden",
          marginBottom: "32px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.9fr) minmax(180px, 0.8fr)",
            backgroundColor: "#e2e8f0",
            color: "#0f172a",
            fontWeight: 700,
          }}
        >
          <div style={{ padding: "18px 22px", borderRight: "1px solid #cbd5e1" }}>
            Varebeskrivelse
          </div>
          <div style={{ padding: "18px 22px" }}>Type salt</div>
        </div>

        {products.map((product, index) => (
          <div
            key={product.name}
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1.9fr) minmax(180px, 0.8fr)",
              backgroundColor: index % 2 === 0 ? "#ffffff" : "#f8fafc",
              borderTop: "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                padding: "18px 22px",
                borderRight: "1px solid #e2e8f0",
                fontSize: "20px",
                lineHeight: 1.45,
              }}
            >
              {product.name}
            </div>
            <div
              style={{
                padding: "18px 22px",
                display: "flex",
                alignItems: "center",
                fontSize: "18px",
                color: "#334155",
                lineHeight: 1.4,
              }}
            >
              {product.saltType}
            </div>
          </div>
        ))}
      </section>

    </main>
  );
}
