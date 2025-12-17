import { NextResponse } from "next/server";
import { verifyAdminRequest } from "@/app/lib/supabase";
import { isValidEmail, isValidUUID } from "@/app/lib/validation";

export async function POST(req: Request) {
  try {
    const auth = await verifyAdminRequest();
    if (!auth.authorized) {
      return NextResponse.json({ error: auth.error }, { status: 401 });
    }

    const body = await req.json();
    const { email, id, type, action } = body;

    if (!type || !["admin", "ban", "scanner"].includes(type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    if (!action || !["add", "remove"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    let roleName = "admin";
    if (type === "ban") roleName = "banned";
    if (type === "scanner") roleName = "scanner";

    if (action === "add") {
      if (!email) {
        return NextResponse.json(
          { error: "Email is required" },
          { status: 400 },
        );
      }

      // Validate email format
      if (!isValidEmail(email)) {
        return NextResponse.json(
          { error: "Invalid email format" },
          { status: 400 },
        );
      }

      // Check if user exists in roles table
      const { data: existing } = await auth
        .adminClient!.from("roles")
        .select("*")
        .eq("email", email)
        .single();

      if (existing) {
        const currentRoles = existing.roles ? existing.roles.split(",") : [];
        if (currentRoles.includes(roleName)) {
          return NextResponse.json(
            {
              error: `This email is already ${type === "admin" ? "an admin" : type === "scanner" ? "a scanner" : "banned"}`,
            },
            { status: 400 },
          );
        }

        // Add role to existing user
        const newRoles = [...currentRoles, roleName].join(",");
        const { data, error } = await auth
          .adminClient!.from("roles")
          .update({ roles: newRoles })
          .eq("id", existing.id)
          .select("*")
          .single();

        if (error) {
          console.error("Update error:", error);
          return NextResponse.json(
            { error: "Failed to update user roles" },
            { status: 500 },
          );
        }

        return NextResponse.json({ success: true, user: data });
      } else {
        // Create new user with role
        const { data, error } = await auth
          .adminClient!.from("roles")
          .insert([{ email, roles: roleName }])
          .select("*")
          .single();

        if (error) {
          console.error("Insert error:", error);
          return NextResponse.json(
            { error: "Failed to add user" },
            { status: 500 },
          );
        }

        return NextResponse.json({ success: true, user: data });
      }
    } else {
      // Remove
      if (!id) {
        return NextResponse.json({ error: "ID is required" }, { status: 400 });
      }

      // Validate UUID format
      if (!isValidUUID(id)) {
        return NextResponse.json(
          { error: "Invalid user ID format" },
          { status: 400 },
        );
      }

      const { data: existing } = await auth
        .adminClient!.from("roles")
        .select("*")
        .eq("id", id)
        .single();

      if (!existing) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const currentRoles = existing.roles ? existing.roles.split(",") : [];
      const newRoles = currentRoles.filter((r: string) => r !== roleName);
      const newRolesString = newRoles.join(",");

      // Update roles
      const { error } = await auth
        .adminClient!.from("roles")
        .update({ roles: newRolesString })
        .eq("id", id);

      if (error) {
        console.error("Delete error:", error);
        return NextResponse.json(
          { error: "Failed to remove user role" },
          { status: 500 },
        );
      }

      return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error("Users action error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
