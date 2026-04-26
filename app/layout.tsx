import type { Metadata } from "next";
import { Great_Vibes, Hedvig_Letters_Serif, Inter } from "next/font/google";
import "./globals.css";
import ClientHeaderBar from "./components/ClientHeaderBar";
import ClientFooter from "./components/ClientFooter";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const hedvigLettersSerif = Hedvig_Letters_Serif({
  variable: "--font-hedvig-letters-serif",
  subsets: ["latin"],
  weight: ["400"],
});

const greatVibes = Great_Vibes({
  variable: "--font-script",
  subsets: ["latin"],
  weight: ["400"],
});

const baseURL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(baseURL),
  title: {
    template: "%s | Stanford Speakers Bureau",
    default: "Stanford Speakers Bureau",
  },
  description:
    "Stanford Speakers Bureau (SSB) is Stanford's largest student organization sponsor of speaking events since 1935. We meet weekly to discuss upcoming speakers and determine who is of interest to the Stanford community.",
  openGraph: {
    siteName: "Stanford Speakers Bureau",
    title: "Stanford Speakers Bureau (SSB)",
    description:
      "Stanford Speakers Bureau (SSB) is Stanford's largest student organization sponsor of speaking events since 1935. We meet weekly to discuss upcoming speakers and determine who is of interest to the Stanford community.",
    images: [
      {
        url: `/speakers/jojo-siwa.jpg`,
        width: 1200,
        height: 630,
      },
    ],
    url: `${baseURL}`,
  },
  twitter: {
    card: "summary_large_image",
  },
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${hedvigLettersSerif.variable} ${greatVibes.variable} antialiased`}
      >
        <ClientHeaderBar />
        {children}
        <ClientFooter />
      </body>
    </html>
  );
}
