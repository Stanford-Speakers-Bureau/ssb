import AdminUsersClient, { Admin, Ban, Scanner } from "./AdminUsersClient";
import { verifyAdminRequest } from "@/app/lib/supabase";

export const dynamic = "force-dynamic";

async function getInitialUsers(): Promise<{
  admins: Admin[];
  bans: Ban[];
  scanners: Scanner[];
}> {
  try {
    const auth = await verifyAdminRequest();
    if (!auth.authorized) {
      return { admins: [], bans: [], scanners: [] };
    }

    const client = auth.adminClient!;

    const { data: allRoles, error: rolesError } = await client
      .from("roles")
      .select("*")
      .order("created_at", { ascending: false });

    if (rolesError) {
      console.error("Roles fetch error:", rolesError);
    }

    const admins = (allRoles || []).filter((r: { roles?: string | null }) =>
      r.roles?.split(",").includes("admin"),
    );
    const bans = (allRoles || []).filter((r: { roles?: string | null }) =>
      r.roles?.split(",").includes("banned"),
    );
    const scanners = (allRoles || []).filter((r: { roles?: string | null }) =>
      r.roles?.split(",").includes("scanner"),
    );

    return {
      admins: (admins || []) as Admin[],
      bans: (bans || []) as Ban[],
      scanners: (scanners || []) as Scanner[],
    };
  } catch (error) {
    console.error("Failed to fetch initial users:", error);
    return { admins: [], bans: [], scanners: [] };
  }
}

export default async function AdminUsersPage() {
  const { admins, bans, scanners } = await getInitialUsers();
  return (
    <AdminUsersClient
      initialAdmins={admins}
      initialBans={bans}
      initialScanners={scanners}
    />
  );
}
