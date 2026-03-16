import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Apartment Finder - Tel Aviv",
  description: "Find your next apartment in Tel Aviv",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
}
