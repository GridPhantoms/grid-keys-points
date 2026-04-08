import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GRID PHANTOMS APP",
  description: "Tools for Grid Phantoms Keyholders",
  icons: {
    icon: "/favicons/favicon.ico",
    apple: "/favicons/apple-touch-icon.png",
  },
  // Stronger viewport to prevent iOS zoom on input focus
  viewport: {
    width: "device-width",
    initialScale: 1.0,
    maximumScale: 1.0,
    userScalable: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={spaceGrotesk.variable}>
      <body className="min-h-full flex flex-col bg-black text-white">
        {children}
      </body>
    </html>
  );
}