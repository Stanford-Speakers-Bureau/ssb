import type { Metadata } from "next";
import HomeClient from "./HomeClient";

export const metadata: Metadata = {
  title: { absolute: "Stanford Speakers Bureau" },
  description:
    "Stanford Speakers Bureau (SSB) is Stanford's largest student organization sponsor of speaking events since 1935. We meet weekly to discuss upcoming speakers and determine who is of interest to the Stanford community.",
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Stanford Speakers Bureau",
            alternateName: "SSB",
            url: process.env.NEXT_PUBLIC_BASE_URL || "https://stanfordspeakersbureau.com",
            logo: `${process.env.NEXT_PUBLIC_BASE_URL || "https://stanfordspeakersbureau.com"}/logo.png`,
            foundingDate: "1935",
            parentOrganization: {
              "@type": "CollegeOrUniversity",
              name: "Stanford University",
            },
          }),
        }}
      />
      <HomeClient />
    </>
  );
}
