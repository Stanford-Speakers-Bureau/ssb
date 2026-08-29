import type { Metadata } from "next";
import { Great_Vibes, Hedvig_Letters_Serif, Inter } from "next/font/google";
import "./globals.css";
import ClientHeaderBar from "./components/ClientHeaderBar";
import ClientFooter from "./components/ClientFooter";
import PostHogIdentifier from "./components/PostHogIdentifier";
import { getBannerData } from "./lib/banner";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Compute the banner's show/hide decision on the server so the first paint
  // already reserves (or doesn't reserve) the right space — no appear-then-
  // collapse layout shift. Auth-dependent popup fields are filled by the
  // client's first refresh; they don't affect the banner's height.
  const initialBannerData = await getBannerData();

  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${hedvigLettersSerif.variable} ${greatVibes.variable} antialiased`}
      >
        <PostHogIdentifier />
        <ClientHeaderBar initialBannerData={initialBannerData} />
        {children}
        <ClientFooter />
      </body>
    </html>
  );
}
