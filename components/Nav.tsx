import Link from "next/link";

export default function Nav() {
  return (
    <nav style={{ marginBottom: "40px" }}>
      <Link href="/" style={{ marginRight: "20px" }}>
        Forside
      </Link>

      <Link href="/om" style={{ marginRight: "20px" }}>
        Om
      </Link>

      <Link href="/kontakt">Kontakt</Link>
    </nav>
  );
}