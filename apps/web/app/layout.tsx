import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Fitness · Vaš prostor",
  description: "Vaš trening, ishrana i stručna podrška na jednom mjestu.",
  robots: { index: false, follow: false },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="bs">
      <body>{children}</body>
    </html>
  );
}
