import Link from "next/link";
import { getSupabaseClient } from "../lib/supabase";

type Stats = {
  pendingSuggestions: number;
  totalEvents: number;
  totalNotifications: number;
  totalUsers: number;
  totalBans: number;
};

export const dynamic = "force-dynamic";

async function getStats(): Promise<Stats> {
  try {
    const supabase = getSupabaseClient();

    const [
      { count: pendingSuggestions },
      { count: totalEvents },
      { count: totalNotifications },
      { count: totalUsers },
      { count: totalBans },
    ] = await Promise.all([
      supabase.from("suggest").select("*", { count: "exact", head: true }).eq("reviewed", false),
      supabase.from("events").select("*", { count: "exact", head: true }),
      supabase.from("notify").select("*", { count: "exact", head: true }),
      supabase.from("admins").select("*", { count: "exact", head: true }),
      supabase.from("bans").select("*", { count: "exact", head: true }),
    ]);

    return {
      pendingSuggestions: pendingSuggestions ?? 0,
      totalEvents: totalEvents ?? 0,
      totalNotifications: totalNotifications ?? 0,
      totalUsers: totalUsers ?? 0,
      totalBans: totalBans ?? 0,
    };
  } catch (error) {
    console.error("Failed to fetch stats on dashboard:", error);
    return {
      pendingSuggestions: 0,
      totalEvents: 0,
      totalNotifications: 0,
      totalUsers: 0,
      totalBans: 0,
    };
  }
}

export default async function AdminDashboard() {
  const stats = await getStats();

  const cards = [
    {
      title: "Pending Suggestions",
      value: stats.pendingSuggestions,
      href: "/admin/suggest",
      icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
      color: "from-amber-500 to-orange-500",
      bgColor: "bg-amber-500/10",
      textColor: "text-amber-400",
    },
    {
      title: "Total Events",
      value: stats.totalEvents,
      href: "/admin/events",
      icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
      color: "from-emerald-500 to-teal-500",
      bgColor: "bg-emerald-500/10",
      textColor: "text-emerald-400",
    },
    {
      title: "Notification Signups",
      value: stats.totalNotifications,
      href: "/admin/notify",
      icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
      color: "from-blue-500 to-indigo-500",
      bgColor: "bg-blue-500/10",
      textColor: "text-blue-400",
    },
    {
      title: "Admins",
      value: stats.totalUsers,
      href: "/admin/users",
      icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
      color: "from-purple-500 to-pink-500",
      bgColor: "bg-purple-500/10",
      textColor: "text-purple-400",
    },
    {
      title: "Banned Users",
      value: stats.totalBans,
      href: "/admin/users",
      icon: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636",
      color: "from-rose-500 to-red-500",
      bgColor: "bg-rose-500/10",
      textColor: "text-rose-400",
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white font-serif mb-2">Dashboard</h1>
        <p className="text-zinc-400">Welcome to the Stanford Speakers Bureau admin panel.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {cards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            prefetch={false}
            className="group bg-zinc-900 rounded-2xl border border-zinc-800 p-6 hover:border-zinc-700 transition-all hover:scale-[1.02]"
          >
            <div className={`w-12 h-12 ${card.bgColor} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
              <svg className={`w-6 h-6 ${card.textColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={card.icon} />
              </svg>
            </div>
            <p className="text-zinc-400 text-sm mb-1">{card.title}</p>
            <p className={`text-3xl font-bold bg-gradient-to-r ${card.color} bg-clip-text text-transparent`}>
              {card.value.toLocaleString()}
            </p>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mt-12">
        <h2 className="text-xl font-bold text-white font-serif mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link
            href="/admin/suggest"
            prefetch={false}
            className="flex items-center gap-3 p-4 bg-zinc-900 rounded-xl border border-zinc-800 hover:border-amber-500/50 hover:bg-amber-500/5 transition-all group"
          >
            <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-white font-medium">Review Suggestions</p>
              <p className="text-zinc-500 text-sm">Approve or reject speakers</p>
            </div>
          </Link>
          
          <Link
            href="/admin/events"
            prefetch={false}
            className="flex items-center gap-3 p-4 bg-zinc-900 rounded-xl border border-zinc-800 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all group"
          >
            <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <div>
              <p className="text-white font-medium">Create Event</p>
              <p className="text-zinc-500 text-sm">Add a new speaker event</p>
            </div>
          </Link>
          
          <Link
            href="/admin/users"
            prefetch={false}
            className="flex items-center gap-3 p-4 bg-zinc-900 rounded-xl border border-zinc-800 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all group"
          >
            <div className="w-10 h-10 bg-purple-500/10 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <div>
              <p className="text-white font-medium">Add Admin</p>
              <p className="text-zinc-500 text-sm">Grant admin access</p>
            </div>
          </Link>
          
          <Link
            href="/admin/notify"
            prefetch={false}
            className="flex items-center gap-3 p-4 bg-zinc-900 rounded-xl border border-zinc-800 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group"
          >
            <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-white font-medium">View Signups</p>
              <p className="text-zinc-500 text-sm">Event notification lists</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

