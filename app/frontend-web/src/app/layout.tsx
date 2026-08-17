import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NarrativeX - AI Story Studio",
  description: "AI Story Studio - Production Foundation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-[#0a0a0c] text-[#ededed]">
        {children}
      </body>
    </html>
  );
}
