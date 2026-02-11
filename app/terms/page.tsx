import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Terms of Service | Stanford Speakers Bureau",
  description:
    "Terms of service for using the Stanford Speakers Bureau website and event services.",
};

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full flex-1 justify-center bg-white dark:bg-black pt-24">
        <section className="w-full max-w-3xl lg:py-8 py-6 px-6 sm:px-12 md:px-16">
          <h1 className="text-3xl sm:text-4xl font-bold text-black dark:text-white mb-2 font-serif">
            Terms of Service
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-10">
            Last updated: February 10, 2026
          </p>

          <div className="prose prose-zinc dark:prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-xl font-bold text-black dark:text-white font-serif mb-3">
                Agreement to terms
              </h2>
              <p className="text-zinc-700 dark:text-zinc-300 text-base leading-relaxed">
                By accessing or using the Stanford Speakers Bureau (SSB)
                website and services, you agree to be bound by these Terms of
                Service. If you do not agree, do not use our services. We may
                update these terms from time to time; continued use after
                changes constitutes acceptance.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-black dark:text-white font-serif mb-3">
                Description of services
              </h2>
              <p className="text-zinc-700 dark:text-zinc-300 text-base leading-relaxed">
                Stanford Speakers Bureau is Stanford&apos;s largest student
                organization sponsor of speaking events since 1935. Our website
                and services allow you to browse upcoming and past speakers,
                claim or purchase tickets for events, suggest speakers, sign
                up for notifications, participate in referral programs, and
                access other event-related features. Services are provided
                &quot;as is&quot; and may change or be discontinued at any time.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-black dark:text-white font-serif mb-3">
                Accounts and eligibility
              </h2>
              <p className="text-zinc-700 dark:text-zinc-300 text-base leading-relaxed mb-4">
                Some features require you to sign in with a Google account. We
                may restrict certain features to Stanford (@stanford.edu)
                accounts. You are responsible for maintaining the
                confidentiality of your account and for all activity under your
                account. You must provide accurate information and comply with
                these terms and applicable laws.
              </p>
              <p className="text-zinc-700 dark:text-zinc-300 text-base leading-relaxed">
                You must be at least 18 years old (or the applicable age in
                your jurisdiction) to use our services. By using our services,
                you represent that you meet any such age requirements.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-black dark:text-white font-serif mb-3">
                Tickets and events
              </h2>
              <p className="text-zinc-700 dark:text-zinc-300 text-base leading-relaxed">
                Tickets and event access are subject to availability and any
                event-specific rules we or our partners publish. Tickets are
                for personal use and may not be resold or transferred for
                commercial gain without our permission. We reserve the right
                to cancel or modify events and to revoke tickets in case of
                fraud, abuse, or violation of these terms or event policies.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-black dark:text-white font-serif mb-3">
                Acceptable use
              </h2>
              <p className="text-zinc-700 dark:text-zinc-300 text-base leading-relaxed mb-4">
                You agree not to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-zinc-700 dark:text-zinc-300 text-base">
                <li>Use our services for any illegal or unauthorized purpose</li>
                <li>Impersonate any person or entity or misrepresent your
                  affiliation</li>
                <li>Attempt to gain unauthorized access to our systems, data,
                  or other users&apos; accounts</li>
                <li>Submit false, misleading, or abusive content (e.g., speaker
                  suggestions)</li>
                <li>Interfere with or disrupt our services or infrastructure</li>
                <li>Scrape, harvest, or automate access in ways that violate
                  our policies or place undue load on our systems</li>
              </ul>
              <p className="text-zinc-700 dark:text-zinc-300 text-base leading-relaxed mt-4">
                We may suspend or terminate your access if we believe you have
                violated these terms or for other operational or legal reasons.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-black dark:text-white font-serif mb-3">
                Intellectual property
              </h2>
              <p className="text-zinc-700 dark:text-zinc-300 text-base leading-relaxed">
                The Stanford Speakers Bureau name, logo, website design, and
                content (except where noted or licensed from third parties) are
                owned by Stanford Speakers Bureau or its licensors. You may not
                use our trademarks or copy our content for commercial purposes
                without our prior written permission. You retain ownership of
                content you submit (e.g., suggestions); you grant us a
                non-exclusive license to use, display, and process that content
                in connection with our services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-black dark:text-white font-serif mb-3">
                Disclaimer of warranties
              </h2>
              <p className="text-zinc-700 dark:text-zinc-300 text-base leading-relaxed">
                Our services are provided &quot;as is&quot; and &quot;as
                available&quot; without warranties of any kind, either express
                or implied, including but not limited to implied warranties of
                merchantability, fitness for a particular purpose, and
                non-infringement. We do not warrant that our services will be
                uninterrupted, error-free, or free of harmful components.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-black dark:text-white font-serif mb-3">
                Governing law and disputes
              </h2>
              <p className="text-zinc-700 dark:text-zinc-300 text-base leading-relaxed">
                These terms shall be governed by the laws of the State of
                California, United States, without regard to conflict of law
                principles. Any dispute arising from these terms or our services
                shall be resolved in the state or federal courts located in
                Santa Clara County, California, and you consent to personal
                jurisdiction in such courts.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-black dark:text-white font-serif mb-3">
                General
              </h2>
              <p className="text-zinc-700 dark:text-zinc-300 text-base leading-relaxed mb-4">
                If any provision of these terms is held invalid or
                unenforceable, the remaining provisions will remain in effect.
                Our failure to enforce any right or provision does not waive
                that right or provision. These terms constitute the entire
                agreement between you and Stanford Speakers Bureau regarding
                our services.
              </p>
              <p className="text-zinc-700 dark:text-zinc-300 text-base leading-relaxed">
                For our practices regarding your personal information, please
                see our{" "}
                <Link href="/privacy" className="text-[#A80D0C] hover:underline font-medium">
                  Privacy Policy
                </Link>
                .
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-black dark:text-white font-serif mb-3">
                Contact
              </h2>
              <p className="text-zinc-700 dark:text-zinc-300 text-base leading-relaxed">
                For questions about these Terms of Service, contact us via our{" "}
                <Link href="/contact" className="text-[#A80D0C] hover:underline font-medium">
                  Contact
                </Link>{" "}
                page.
              </p>
            </section>
          </div>

          <div className="mt-12 pt-8 border-t border-zinc-200 dark:border-zinc-700">
            <Link
              href="/"
              className="text-[#A80D0C] hover:underline font-medium text-sm"
            >
              ← Back to home
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
