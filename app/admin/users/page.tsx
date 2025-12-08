import AdminUsersClient, { Admin, Ban } from "./AdminUsersClient";
import { verifyAdminRequest } from "../../lib/supabase";

export const dynamic = "force-dynamic";

async function getInitialUsers(): Promise<{ admins: Admin[]; bans: Ban[] }> {
  try {
    const auth = await verifyAdminRequest();
    if (!auth.authorized) {
      return { admins: [], bans: [] };
    }

    const client = auth.adminClient!;

    const [
      { data: admins, error: adminsError },
      { data: bans, error: bansError },
    ] = await Promise.all([
      client
        .from("admins")
        .select("*")
        .order("created_at", { ascending: false }),
      client.from("bans").select("*").order("created_at", { ascending: false }),
    ]);

    if (adminsError) {
      console.error("Admins fetch error:", adminsError);
    }
    if (bansError) {
      console.error("Bans fetch error:", bansError);
    }

    return {
      admins: (admins || []) as Admin[],
      bans: (bans || []) as Ban[],
    };
  } catch (error) {
    console.error("Failed to fetch initial users:", error);
    return { admins: [], bans: [] };
  }
}

export default async function AdminUsersPage() {
  const { admins, bans } = await getInitialUsers();
  return <AdminUsersClient initialAdmins={admins} initialBans={bans} />;
}
