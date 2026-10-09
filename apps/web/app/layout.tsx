import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./interface.css";
import "./mobile-first.css";
import "./premium-workspace.css";
import "./navigation-catalog.css";
import { GeistSans } from "geist/font/sans";
import InstallApp from "@/components/install-app";
const themeScript = `(function(){try{var t=localStorage.getItem('alda-theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';document.documentElement.style.colorScheme=d?'dark':'light'}catch(e){}})()`;
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f5f5f5",
};
export const metadata: Metadata = {
  title: "Alda Connect · Vaš prostor",
  description: "Vaš trening, ishrana i stručna podrška na jednom mjestu.",
  robots: { index: false, follow: false },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Alda Connect",
  },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="bs" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={GeistSans.variable}>
        {children}
        <InstallApp />
      </body>
    </html>
  );
}
