import { createServerSupabaseClient } from "../lib/supabase";
import Image from "next/image";
import Link from "next/link";
import SuggestForm from "./SuggestForm";

export default async function SuggestPage() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Get user metadata from Google OAuth
  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || null;
  const userAvatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;

  return (
    <div className="flex min-h-screen flex-col items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full flex-1 justify-center bg-white dark:bg-black pt-16">
        <section className="w-full max-w-2xl flex flex-col py-12 px-6 sm:px-12 md:px-16">
          <h1 className="text-3xl sm:text-4xl font-bold text-black dark:text-white mb-4 font-serif">
            Suggest a Speaker
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 mb-4 text-base leading-relaxed">
            Have someone you&apos;d love to see speak at Stanford? We want to hear from you! 
            Submit the name of a person you think would make an amazing speaker for the Stanford community.
          </p>
          <p className="text-zinc-500 dark:text-zinc-500 mb-8 text-sm leading-relaxed">
            Your suggestion will be reviewed by our team. While we can&apos;t guarantee we&apos;ll be able 
            to bring every suggested speaker to campus, we genuinely appreciate your input!
          </p>
          
          {user ? (
            <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-6 sm:p-8 border border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-3 mb-6">
                {userAvatar ? (
                  <Image
                    src={userAvatar}
                    alt={userName || "Profile"}
                    width={40}
                    height={40}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[#A80D0C] flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                )}
                <div>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Signed in as</p>
                  {userName && (
                    <p className="text-black dark:text-white font-medium">{userName}</p>
                  )}
                  <p className="text-black dark:text-white text-sm">{user.email}</p>
                </div>
              </div>
              
              <SuggestForm />
            </div>
          ) : (
            <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-6 sm:p-8 border border-zinc-200 dark:border-zinc-800 text-center">
              <div className="w-16 h-16 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-zinc-400 dark:text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-black dark:text-white mb-2">
                Sign in to submit a suggestion
              </h2>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">
                Please sign in with your Stanford Google account to suggest a speaker.
              </p>
              <Link
                href="/api/auth/google?redirect_to=/suggest"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white
                           bg-[#A80D0C] hover:bg-[#8a0b0a] transition-all shadow-md hover:shadow-lg"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
              </Link>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

