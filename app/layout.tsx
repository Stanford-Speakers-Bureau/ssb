import type { Metadata } from "next";
import { Inter, Hedvig_Letters_Serif } from "next/font/google";
import "./globals.css";
import ClientHeaderBar from "./components/ClientHeaderBar";
import Footer from "./components/Footer";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const hedvigLettersSerif = Hedvig_Letters_Serif({
  variable: "--font-hedvig-letters-serif",
  subsets: ["latin"],
  weight: ["400"],
});

const baseURL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(baseURL),
  title: "Stanford Speakers Bureau",
  description:
    "Stanford Speakers Bureau (SSB) is Stanford's largest student organization sponsor of speaking events since 1935. We meet weekly to discuss upcoming speakers and determine who is of interest to the Stanford community.",
  openGraph: {
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${hedvigLettersSerif.variable} antialiased`}
      >
        <ClientHeaderBar />
        {children}
        <Footer />
      </body>
    </html>
  );
}
