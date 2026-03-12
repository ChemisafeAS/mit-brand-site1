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
        <div
          style={{
            maxWidth: "900px",
            margin: "0 auto",
            padding: "30px 20px",
            fontFamily: "Arial, sans-serif",
          }}
        >
          <Nav />
          {children}
        </div>
      </body>
    </html>
  );
}