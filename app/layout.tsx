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
            maxWidth: "1120px",
            margin: "0 auto",
            padding: "20px",
            fontFamily: "Arial, Helvetica, sans-serif",
          }}
        >
          <Nav />
          {children}
        </div>
      </body>
    </html>
  );
}