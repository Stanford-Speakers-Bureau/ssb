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
import "./globals.css";
import ClientHeaderBar from "./components/ClientHeaderBar";
import ClientFooter from "./components/ClientFooter";
import ThemeSwitcher from "./components/ThemeSwitcher";

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
    <html lang="en" className="dark theme-editorial">
      <body
        className={`${inter.variable} ${hedvigLettersSerif.variable} ${greatVibes.variable} ${fraunces.variable} ${bricolage.variable} ${spaceGrotesk.variable} ${anton.variable} antialiased`}
      >
        {/* Dev-only: apply the saved theme before paint to avoid a flash. */}
        {process.env.NODE_ENV === "development" && (
          <script
            dangerouslySetInnerHTML={{
              __html:
                "try{var t=localStorage.getItem('ssb-theme')||'editorial';var c=['theme-editorial','theme-ember','theme-press','theme-marquee'];var d=document.documentElement;c.forEach(function(x){d.classList.remove(x)});d.classList.add('theme-'+t)}catch(e){}",
            }}
          />
        )}
        <ClientHeaderBar />
        {children}
        <ClientFooter />
        {/* Dev-only: site-wide theme switcher. Removed at finalize once a theme is chosen. */}
        {process.env.NODE_ENV === "development" && <ThemeSwitcher />}
      </body>
    </html>
  );
}
