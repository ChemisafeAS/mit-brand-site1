import Link from "next/link";
import Image from "next/image";

export default function Nav() {
  return (
    <nav
      style={{
        position: "sticky",
        top: 0,
        zIndex: 1000,
        width: "100%",
        background:
          "linear-gradient(90deg, rgba(15,23,42,0.96) 0%, rgba(30,41,59,0.92) 100%)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div
        style={{
          maxWidth: "1440px",
          margin: "0 auto",
          padding: "18px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "24px",
          color: "white",
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "28px",
            fontWeight: "bold",
          }}
        >
          <Image
            src="/logo.png"
            alt="Chemisafe A/S logo"
            width={52}
            height={52}
            style={{ width: "52px", height: "52px", objectFit: "contain" }}
          />
          <span>Chemisafe A/S</span>
        </Link>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "28px",
            flexWrap: "wrap",
            fontSize: "18px",
          }}
        >
          <Link href="/">Forside</Link>
          <Link href="/om">Om</Link>
          <Link href="/kontakt">Kontakt</Link>
          <a
            href="mailto:ordre@chemisafe.dk"
            style={{
              padding: "12px 18px",
              backgroundColor: "#0ea5e9",
              borderRadius: "999px",
              fontWeight: "bold",
            }}
          >
            Få tilbud
          </a>
        </div>
      </div>
    </nav>
  );
}