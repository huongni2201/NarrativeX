import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "./providers";

export const metadata: Metadata = {
  title: "NarrativeX - AI Story Video Studio",
  description: "Biến truyện chữ thành video sống động với vai nhân vật nhất quán.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="dark">
      <body className="antialiased min-h-screen bg-[#070b14] text-[#f8fafc] selection:bg-purple-600 selection:text-white">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
