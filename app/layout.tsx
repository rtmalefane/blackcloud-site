import type { Metadata } from "next";
import { Geist, Geist_Mono, Rajdhani, Poiret_One, Silkscreen } from "next/font/google";
import "./globals.css";
import SiteHeader from "./components/SiteHeader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const rajdhani = Rajdhani({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-rajdhani",
});

const poiretOne = Poiret_One({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-poiret",
});

const silkscreen = Silkscreen({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-silkscreen",
});

// Lavishly Yours is not in next/font/google — load via <link> in globals.css @import
// Add this to the top of globals.css:
// @import url('https://fonts.googleapis.com/css2?family=Lavishly+Yours:wght@400;700&display=swap');

export const metadata: Metadata = {
  title: "Black Cloud",
  description: "Designing the atmosphere of tomorrow",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Poiret+One&family=Parisienne&family=Noto+Serif+Hentaigana&display=swap" rel="stylesheet" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${rajdhani.variable} ${poiretOne.variable} ${silkscreen.variable} antialiased`}
      >
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
