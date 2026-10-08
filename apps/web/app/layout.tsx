import type { Metadata } from "next";
import "./globals.css";
import InstallApp from "@/components/install-app";
export const metadata: Metadata = {
  title: "Fitness · Vaš prostor",
  description: "Vaš trening, ishrana i stručna podrška na jednom mjestu.",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Fitness" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="bs">
      <body>
        {children}
        <InstallApp />
      </body>
    </html>
  );
}
