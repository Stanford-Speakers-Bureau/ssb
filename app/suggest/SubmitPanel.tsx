import Link from "next/link";
import SuggestForm from "./SuggestForm";
import { getUserInitials } from "./data";

type SubmitPanelProps = {
  user: {
    email?: string | null;
    displayName?: string | null;
  } | null;
  /** Path to bounce back to after Stanford SSO. Defaults to /suggest. */
  signInRedirect?: string;
  /** Override the eyebrow / heading copy on the submit card. */
  eyebrow?: string;
  heading?: string;
};

export default function SubmitPanel({
  user,
  signInRedirect = "/suggest",
  eyebrow = "Submit",
  heading = "Add a name to the list",
}: SubmitPanelProps) {
  if (user) {
    const userName = user.displayName || null;
    const userInitials = getUserInitials(userName, user.email || null);

    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6 sm:p-8 shadow-sm">
        <p className="text-xs uppercase tracking-[0.3em] text-[#A80D0C] mb-2">
          {eyebrow}
        </p>
        <h3 className="font-serif text-2xl sm:text-3xl text-white mb-5 leading-tight">
          {heading}
        </h3>
        <div className="flex items-center gap-3 mb-6 pb-5 border-b border-zinc-800">
          <div className="shrink-0 w-9 h-9 rounded-full bg-[#A80D0C] flex items-center justify-center text-xs font-semibold text-white">
            {userInitials}
          </div>
          <div className="min-w-0 flex-1 text-xs leading-tight">
            <p className="text-zinc-500 uppercase tracking-wider">
              Signed in as
            </p>
            <p className="text-white font-medium truncate mt-0.5">
              {userName || user.email}
            </p>
          </div>
        </div>
        <SuggestForm />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-8 text-center shadow-sm">
      <p className="text-xs uppercase tracking-[0.3em] text-[#A80D0C] mb-3">
        Sign in required
      </p>
      <h3 className="font-serif text-2xl text-white mb-3 leading-tight">
        Use your Stanford account to suggest and vote
      </h3>
      <p className="font-sans text-sm text-zinc-400 max-w-md mx-auto mb-6 leading-relaxed">
        One account, one vote. Takes a few seconds through Stanford SSO.
      </p>
      <Link
        href={`/api/auth/login?redirect_to=${encodeURIComponent(signInRedirect)}`}
        prefetch={false}
        className="inline-flex items-center gap-2 rounded-full bg-[#A80D0C] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#A80D0C]/20 transition-colors hover:bg-[#C11211]"
      >
        Sign in with Stanford
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}
