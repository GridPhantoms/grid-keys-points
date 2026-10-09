import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const spaceGrotesk = localFont({
  src: "./fonts/space-grotesk-latin.woff2",
  weight: "400 700",
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL('https://gridphantoms.app'),
  title: 'Grid Phantoms | Keyholder Governance, Intelligence and Utility',
  description: 'Enter the Grid: Keyholder governance, treasury transparency, adopted $BYTES utility intelligence, Citizen market tools and read-only Key data.',
  applicationName: 'Grid Phantoms',
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'Grid Phantoms',
    title: 'Grid Phantoms | Keyholder Governance, Intelligence and Utility',
    description: 'Keyholder governance, treasury transparency, $BYTES utility intelligence and Citizen market tools.',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Grid Phantoms keyholder governance, intelligence and utility',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Grid Phantoms | Keyholder Governance, Intelligence and Utility',
    description: 'Keyholder governance, treasury transparency, $BYTES utility intelligence and Citizen market tools.',
    images: ['/opengraph-image'],
  },
  icons: {
    icon: '/favicons/favicon.ico',
    apple: '/favicons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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