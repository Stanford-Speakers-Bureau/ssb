import { redirect } from "next/navigation";
import { getSessionUser } from "@/app/lib/auth";
import { recordMailingListMember } from "@/app/lib/mailing-list";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Join our Mailing List — Stanford Speakers Bureau",
  robots: { index: false, follow: false },
};

export default async function SubscribePage() {
  const user = await getSessionUser();
  if (!user?.email) {
    redirect(`/api/auth/login?redirect_to=${encodeURIComponent("/subscribe")}`);
  }

  await recordMailingListMember({ email: user.email, source: "manual" });
  redirect("/?subscribed=1");
}
