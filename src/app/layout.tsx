import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Panini Mundial 2026",
  description: "Inventario por usuario para el album Panini FIFA World Cup 2026"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
