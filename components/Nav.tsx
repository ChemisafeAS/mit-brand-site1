import Link from "next/link";
import Image from "next/image";

export default function Nav() {
  return (
    <nav
      style={{
        position: "sticky",
        top: "16px",
        zIndex: 1000,
        marginBottom: "32px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "20px",
          padding: "16px 20px",
          backgroundColor: "#0f172a",
          color: "white",
          borderRadius: "18px",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.18)",
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontWeight: "bold",
            fontSize: "20px",
          }}
        >
          <Image
            src="/logo.png"
            alt="Chemisafe A/S logo"
            width={46}
            height={46}
            style={{
              width: "46px",
              height: "46px",
              objectFit: "contain",
              borderRadius: "10px",
              backgroundColor: "white",
              padding: "4px",
            }}
          />
          <span>Chemisafe A/S</span>
        </Link>

        <div
          style={{
            display: "flex",
            gap: "20px",
            flexWrap: "wrap",
            fontSize: "15px",
          }}
        >
          <Link href="/">Forside</Link>
          <Link href="/om">Om</Link>
          <Link href="/kontakt">Kontakt</Link>
        </div>
      </div>
    </nav>
  );
}