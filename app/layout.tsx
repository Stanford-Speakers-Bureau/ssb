import type { Metadata } from "next";
import { Inter, Hedvig_Letters_Serif } from "next/font/google";
import "./globals.css";
import NavBar from "./components/NavBar";
import BannerBar from "@/app/components/BannerBar";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const hedvigLettersSerif = Hedvig_Letters_Serif({
  variable: "--font-hedvig-letters-serif",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Stanford Speakers Bureau",
  description: "Stanford's largest student organization sponsor of speaking events since 1935. We meet weekly to discuss upcoming speakers and determine who is of interest to the Stanford community.",
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
        <BannerBar />
        <NavBar banner={true} />
        {children}
      </body>
    </html>
  );
}
