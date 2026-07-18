import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegistrarSW from "@/components/RegistrarSW";

export const metadata: Metadata = {
  title: "Lingo — Francês que faz sentido",
  description:
    "Francês para quem fala português: gramática-ponte, frases com voz para usar na hora e um tutor que mostra E fala.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Lingo",
  },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  // Protótipo aberto, mas fora dos buscadores.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0d1020",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}
