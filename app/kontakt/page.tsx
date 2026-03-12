export default function KontaktPage() {
  return (
    <main
      style={{
        backgroundColor: "white",
        padding: "40px",
        borderRadius: "24px",
        boxShadow: "0 10px 40px rgba(15, 23, 42, 0.08)",
      }}
    >
      <h1 style={{ fontSize: "42px", marginBottom: "20px" }}>Kontakt</h1>

      <p
        style={{
          fontSize: "18px",
          lineHeight: "1.8",
          marginBottom: "12px",
          color: "#475569",
        }}
      >
        Ring til os på <strong>86 44 79 00</strong>
      </p>

      <p
        style={{
          fontSize: "18px",
          lineHeight: "1.8",
          marginBottom: "12px",
          color: "#475569",
        }}
      >
        Skriv til <strong>ordre@chemisafe.dk</strong>
      </p>

      <p style={{ fontSize: "18px", lineHeight: "1.8", color: "#475569" }}>
        Kontakt os gerne for tilbud eller spørgsmål om vores produkter.
      </p>
    </main>
  );
}