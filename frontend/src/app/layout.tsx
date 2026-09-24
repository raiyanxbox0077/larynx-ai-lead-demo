import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Larynx AI · Lead Response Studio",
  description: "A live demonstration of fast, consent-aware real estate lead engagement.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-IN">
      <body>{children}</body>
    </html>
  );
}
