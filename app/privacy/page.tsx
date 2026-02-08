import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Stanford Speakers Bureau",
  description:
    "Privacy policy for Stanford Speakers Bureau: how we collect, use, and protect your information when you use our website and services.",
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full flex-1 justify-center bg-white dark:bg-black pt-24">
        <section className="w-full max-w-3xl lg:py-8 py-6 px-6 sm:px-12 md:px-16">
          <h1 className="text-3xl sm:text-4xl font-bold text-black dark:text-white mb-2 font-serif">
            Privacy Policy
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-10">
            Last updated: February 7, 2025
          </p>

          <div className="prose prose-zinc dark:prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-xl font-bold text-black dark:text-white font-serif mb-3">
                Who we are
              </h2>
              <p className="text-zinc-700 dark:text-zinc-300 text-base leading-relaxed">
                Stanford Speakers Bureau (SSB) is Stanford&apos;s largest
                student organization sponsor of speaking events since 1935. This
                privacy policy describes how we collect, use, and protect
                information when you use our website and services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-black dark:text-white font-serif mb-3">
                Information we collect
              </h2>
              <p className="text-zinc-700 dark:text-zinc-300 text-base leading-relaxed mb-4">
                We collect information you provide directly and through your use
                of our services:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-zinc-700 dark:text-zinc-300 text-base">
                <li>
                  <strong>Account information:</strong> When you sign in with
                  Google, we receive your email address and basic profile
                  information (e.g., name) from Google. We use Stanford
                  (@stanford.edu) sign-in for relevant features.
                </li>
                <li>
                  <strong>Ticket and event data:</strong> When you claim or
                  purchase a ticket, we store your email address and associate it
                  with the event and ticket type for check-in and event
                  management.
                </li>
                <li>
                  <strong>Speaker suggestions and notifications:</strong> If you
                  suggest a speaker or sign up to be notified about a speaker
                  reveal, we store your email and the related submission so we
                  can process suggestions and send notifications.
                </li>
                <li>
                  <strong>Referral and waitlist data:</strong> If you join a
                  waitlist or participate in referral programs for events, we
                  store the information needed to run those features (e.g.,
                  email, referral links).
                </li>
                <li>
                  <strong>Usage and technical data:</strong> Our hosting and
                  analytics may collect general usage data (e.g., pages visited,
                  device type) in line with standard web practices.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-black dark:text-white font-serif mb-3">
                How we use your information
              </h2>
              <p className="text-zinc-700 dark:text-zinc-300 text-base leading-relaxed mb-4">
                We use the information we collect to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-zinc-700 dark:text-zinc-300 text-base">
                <li>Provide, operate, and improve our events and website</li>
                <li>Manage tickets, check-in, and event access</li>
                <li>Send you notifications you have requested (e.g., speaker
                  announcements)</li>
                <li>Process and attribute speaker suggestions</li>
                <li>Run referral and waitlist programs for events</li>
                <li>Respond to inquiries and communicate with you</li>
                <li>Comply with legal obligations and protect our rights</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-black dark:text-white font-serif mb-3">
                Third-party services
              </h2>
              <p className="text-zinc-700 dark:text-zinc-300 text-base leading-relaxed mb-4">
                We use services that may process your data on our behalf:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-zinc-700 dark:text-zinc-300 text-base">
                <li>
                  <strong>Google:</strong> For sign-in (OAuth). When you sign in
                  with Google, Google provides us your email and basic profile
                  information according to your Google account settings and
                  Google&apos;s privacy policy.
                </li>
                <li>
                  <strong>Supabase:</strong> For authentication, database, and
                  hosting. Data is stored in secure, access-controlled
                  environments.
                </li>
                <li>
                  <strong>Hosting and infrastructure:</strong> Our site may be
                  hosted on services that process requests and logs; we choose
                  providers with strong security and privacy practices.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-black dark:text-white font-serif mb-3">
                Data retention and security
              </h2>
              <p className="text-zinc-700 dark:text-zinc-300 text-base leading-relaxed">
                We retain your data only as long as needed to provide our
                services, run events, and meet legal or operational needs.
                Ticket and account data may be retained for historical and
                audit purposes. We implement appropriate technical and
                organizational measures to protect your data against unauthorized
                access, loss, or misuse.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-black dark:text-white font-serif mb-3">
                Your choices and rights
              </h2>
              <p className="text-zinc-700 dark:text-zinc-300 text-base leading-relaxed mb-4">
                You can:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-zinc-700 dark:text-zinc-300 text-base">
                <li>Sign out of your account at any time from your account
                  page</li>
                <li>Request access to or correction of your personal data by
                  contacting us</li>
                <li>Ask us to delete or restrict processing of your data,
                  subject to legal and operational requirements</li>
              </ul>
              <p className="text-zinc-700 dark:text-zinc-300 text-base leading-relaxed mt-4">
                If you are in a jurisdiction that provides additional rights
                (e.g., GDPR, CCPA), you may have the right to access, port,
                correct, or delete your data or to object to or restrict
                processing. Contact us to exercise these rights.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-black dark:text-white font-serif mb-3">
                Children
              </h2>
              <p className="text-zinc-700 dark:text-zinc-300 text-base leading-relaxed">
                Our services are directed at the Stanford community and general
                audiences. We do not knowingly collect personal information from
                children under 13. If you believe we have collected such
                information, please contact us so we can delete it.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-black dark:text-white font-serif mb-3">
                Changes to this policy
              </h2>
              <p className="text-zinc-700 dark:text-zinc-300 text-base leading-relaxed">
                We may update this privacy policy from time to time. We will
                post the updated policy on this page and update the &quot;Last
                updated&quot; date. Continued use of our services after changes
                constitutes acceptance of the updated policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-black dark:text-white font-serif mb-3">
                Contact us
              </h2>
              <p className="text-zinc-700 dark:text-zinc-300 text-base leading-relaxed">
                For questions about this privacy policy or our data practices,
                reach out via our{" "}
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
