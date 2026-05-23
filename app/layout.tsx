import type { Metadata } from "next";
import {
  Anton,
  Bricolage_Grotesque,
  Fraunces,
  Great_Vibes,
  Hedvig_Letters_Serif,
  Inter,
  Space_Grotesk,
} from "next/font/google";
import Script from "next/script";
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

// Display faces for the upcoming-speakers theme explorations.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const anton = Anton({
  variable: "--font-anton",
  subsets: ["latin"],
  weight: ["400"],
});

const baseURL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(baseURL),
  title: {
    template: "%s | Stanford Speakers Bureau",
    default: "Stanford Speakers Bureau (SSB)",
  },
  description:
    "Stanford Speakers Bureau (SSB) is Stanford's largest student organization sponsor of speaking events since 1935. We meet weekly to discuss upcoming speakers and determine who is of interest to the Stanford community.",
  openGraph: {
    siteName: "Stanford Speakers Bureau",
    title: "Stanford Speakers Bureau (SSB)",
    description:
      "Stanford Speakers Bureau (SSB) is Stanford's largest student organization sponsor of speaking events since 1935. We meet weekly to discuss upcoming speakers and determine who is of interest to the Stanford community.",
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
        className={`${inter.variable} ${hedvigLettersSerif.variable} ${greatVibes.variable} ${fraunces.variable} ${bricolage.variable} ${spaceGrotesk.variable} ${anton.variable} antialiased`}
      >
        <ClientHeaderBar />
        {children}
        <ClientFooter />
        {/* Temporary: ui.sh theme picker for the upcoming-speakers redesign.
            Dev-only so it never ships to production; removed at finalize. */}
        {process.env.NODE_ENV === "development" && (
          <Script src="https://ui.sh/ui-picker.js" />
        )}
      </body>
    </html>
  );
}
