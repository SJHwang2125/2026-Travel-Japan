import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Japan 2026 | Smart Itinerary",
  description: "Interactive travel itinerary for Japan 2026",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Pretendard:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      </head>
      <body className="h-[100dvh] flex flex-col relative overflow-hidden bg-slate-950 text-slate-50">
        {children}
      </body>
    </html>
  );
}