import type { Metadata } from "next";
import { Inter, Hedvig_Letters_Serif } from "next/font/google";
import "./globals.css";
import SiteChrome from "./components/SiteChrome";
import { getClosestUpcomingEvent } from "./lib/supabase";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const hedvigLettersSerif = Hedvig_Letters_Serif({
  variable: "--font-hedvig-letters-serif",
  subsets: ["latin"],
  weight: ["400"],
});

const baseURL = "https://ssb.stanford.edu";

export const metadata: Metadata = {
  metadataBase: new URL("https://ssb.stanford.edu"),
  title: "Stanford Speakers Bureau",
  description:
    "Stanford's largest student organization sponsor of speaking events since 1935. We meet weekly to discuss upcoming speakers and determine who is of interest to the Stanford community.",
  openGraph: {
    title: "Stanford Speakers Bureau",
    description:
      "Stanford's largest student organization sponsor of speaking events since 1935. We meet weekly to discuss upcoming speakers and determine who is of interest to the Stanford community.",
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const closestEvent = await getClosestUpcomingEvent();

  // Determine if speaker is still a mystery (before release_date)
  const now = new Date();
  const releaseDate = closestEvent?.release_date
    ? new Date(closestEvent.release_date)
    : null;
  const isMystery = releaseDate ? now < releaseDate : !closestEvent?.name;

  // Show banner if there's an upcoming event
  const showBanner = !!closestEvent;

  // Banner text and countdown target based on mystery status
  const bannerText = isMystery
    ? "GET NOTIFIED ABOUT OUR NEXT SPEAKER!!"
    : `${closestEvent?.name} is coming to Stanford!`;
  const countdownTarget = isMystery
    ? closestEvent?.release_date
    : closestEvent?.start_time_date;
  const prefaceLabel = isMystery
    ? "Speaker Name & Ticket Reveal in"
    : "Event starts in";

  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${hedvigLettersSerif.variable} antialiased`}
      >
        <SiteChrome
          showBanner={showBanner}
          bannerProps={{
            text: bannerText,
            href: "/upcoming-speakers",
            prefaceLabel,
            target: countdownTarget || undefined,
          }}
        />
        {children}
      </body>
    </html>
  );
}
