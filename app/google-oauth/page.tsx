import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Sign in with Google | Stanford Speakers Bureau",
  description:
    "Learn how Stanford Speakers Bureau uses Google sign-in, what data we request, and how we use it. Visible without logging in.",
};

export default function GoogleOAuthPage() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full flex-1 justify-center bg-white dark:bg-black pt-24">
        <section className="w-full max-w-3xl lg:py-8 py-6 px-6 sm:px-12 md:px-16">
          <h1 className="text-3xl sm:text-4xl font-bold text-black dark:text-white mb-2 font-serif">
            Sign in with Google
          </h1>
          <p className="text-base text-zinc-600 dark:text-zinc-400 mb-10">
            Stanford Speakers Bureau uses Google sign-in to securely identify
            you. This page explains who we are, what our app does, and why we
            request your data. You can read it without logging in.
          </p>

          <div className="prose prose-zinc dark:prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-xl font-bold text-black dark:text-white font-serif mb-3">
                Our app and brand
              </h2>
              <p className="text-zinc-700 dark:text-zinc-300 text-base leading-relaxed">
                <strong>Stanford Speakers Bureau (SSB)</strong> is Stanford
                University&apos;s largest student organization sponsor of
                speaking events, operating since 1935. We are a recognized
                Stanford student group. This website is our official,
                verified presence. Our homepage, privacy policy, and terms of
                service are hosted on our own domain (this site), not on
                third-party platforms such as Google Sites or social media
                subdomains.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-black dark:text-white font-serif mb-3">
                What our app does
              </h2>
              <p className="text-zinc-700 dark:text-zinc-300 text-base leading-relaxed mb-4">
                Our application provides the following functionality to users:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-zinc-700 dark:text-zinc-300 text-base">
                <li>
                  <strong>Browse events and speakers:</strong> View upcoming and
                  past speakers and event details without signing in.
                </li>
                <li>
                  <strong>Claim or purchase tickets:</strong> Sign in to claim
                  free tickets or complete ticket purchases for SSB events.
                  Your email is used to associate tickets with your account and
                  for check-in.
                </li>
                <li>
                  <strong>Manage your account:</strong> View and manage your
                  tickets and account in one place after signing in.
                </li>
                <li>
                  <strong>Suggest speakers:</strong> Submit speaker suggestions
                  for future events. We use your identity (email/account) to
                  attribute suggestions and prevent abuse.
                </li>
                <li>
                  <strong>Get notified:</strong> Sign up to be notified when a
                  mystery speaker is announced. We use your email to send those
                  notifications.
                </li>
                <li>
                  <strong>Referrals and waitlists:</strong> Participate in
                  event referral programs and waitlists; we use your email and
                  referral data to run these features.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-black dark:text-white font-serif mb-3">
                Why we request your data (transparency)
              </h2>
              <p className="text-zinc-700 dark:text-zinc-300 text-base leading-relaxed mb-4">
                When you choose &quot;Sign in with Google,&quot; we request
                access to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-zinc-700 dark:text-zinc-300 text-base">
                <li>
                  <strong>Email address:</strong> To create and identify your
                  account, link your tickets to you, send notifications you
                  requested (e.g., speaker announcements), and process speaker
                  suggestions and referral/waitlist signups.
                </li>
                <li>
                  <strong>Basic profile information (e.g., name):</strong> To
                  personalize your experience and display your identity where
                  relevant (e.g., on your account page or in admin tools for
                  ticket management).
                </li>
              </ul>
              <p className="text-zinc-700 dark:text-zinc-300 text-base leading-relaxed mt-4">
                We use this data only to provide and improve the services
                described above. We do not sell your personal information. For
                some features we restrict sign-in to Stanford (@stanford.edu)
                accounts to serve the Stanford community. For full details on
                what we collect, how we use it, and your rights, see our
                Privacy Policy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-black dark:text-white font-serif mb-3">
                Privacy policy
              </h2>
              <p className="text-zinc-700 dark:text-zinc-300 text-base leading-relaxed">
                Our privacy policy describes in detail what data we collect,
                how we use it, who we share it with, and how you can exercise
                your rights.
                sign-in:
              </p>
              <p className="mt-4">
                <Link
                  href="/privacy"
                  className="inline-flex items-center gap-2 rounded px-4 py-2 text-base font-semibold text-white bg-[#A80D0C] transition-colors hover:bg-[#C11211]"
                >
                  View our Privacy Policy
                </Link>
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-black dark:text-white font-serif mb-3">
                Terms of service
              </h2>
              <p className="text-zinc-700 dark:text-zinc-300 text-base leading-relaxed">
                Use of our services is also governed by our{" "}
                <Link href="/terms" className="text-[#A80D0C] hover:underline font-medium">
                  Terms of Service
                </Link>
                , which cover acceptable use, tickets, and other legal terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-black dark:text-white font-serif mb-3">
                Contact
              </h2>
              <p className="text-zinc-700 dark:text-zinc-300 text-base leading-relaxed">
                For questions about sign-in, data use, or this app, contact us via our{" "}
                <Link href="/contact" className="text-[#A80D0C] hover:underline font-medium">
                  Contact
                </Link>{" "}
                page.
              </p>
            </section>
          </div>

          <div className="mt-12 pt-8 border-t border-zinc-200 dark:border-zinc-700 flex flex-wrap gap-4">
            <Link
              href="/"
              className="text-[#A80D0C] hover:underline font-medium text-sm"
            >
              ← Back to home
            </Link>
            <Link
              href="https://www.stanfordspeakersbureau.com/privacy"
              className="text-[#A80D0C] hover:underline font-medium text-sm"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-[#A80D0C] hover:underline font-medium text-sm"
            >
              Terms of Service
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
