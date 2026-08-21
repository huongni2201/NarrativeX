import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProviders } from "./providers";

export const metadata: Metadata = {
  title: "NarrativeX - AI Story Video Studio",
  description: "Biến truyện chữ thành video sống động với vai nhân vật nhất quán.",
};

export const viewport: Viewport = {
  themeColor: "var(--background)",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="dark">
      <body className="antialiased min-h-screen bg-background text-text-primary selection:bg-primary selection:text-white">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
