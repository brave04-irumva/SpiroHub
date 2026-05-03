import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getClients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error("Supabase environment variables are not configured.");
  }

  return {
    anonClient: createClient(url, anonKey),
    adminClient: createClient(url, serviceRoleKey),
  };
}

async function findAuthUserIdByEmail(adminClient: any, email: string): Promise<string | null> {
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) return null;

    const users = data?.users ?? [];
    const found = users.find((u: any) => (u.email || "").toLowerCase() === email.toLowerCase());
    if (found?.id) return found.id;

    if (users.length < perPage) break;
    page += 1;
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : "";

    if (!token) {
      return NextResponse.json({ error: "Missing authorization token." }, { status: 401 });
    }

    const { anonClient, adminClient } = getClients();

    const {
      data: { user },
      error: userError,
    } = await anonClient.auth.getUser(token);

    if (userError || !user?.email) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const { data: actor } = await adminClient
      .from("officers")
      .select("role")
      .eq("email", user.email)
      .single();

    if (actor?.role !== "ADMIN") {
      return NextResponse.json({ error: "Admin permission required." }, { status: 403 });
    }

    const body = await req.json();
    const role = String(body.role || "").toUpperCase();
    const id = String(body.id || "");
    const email = String(body.email || "").trim().toLowerCase();

    if (!role || !id || !email) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    if (email === "admin@daystar.ac.ke") {
      return NextResponse.json({ error: "Default admin account cannot be deleted." }, { status: 400 });
    }

    if (role === "STUDENT") {
      const { error: profileError } = await adminClient.from("students").delete().eq("id", id);
      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 400 });
      }
    } else {
      const { error: profileError } = await adminClient.from("officers").delete().eq("id", id);
      if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 400 });
      }
    }

    const authUserId = await findAuthUserIdByEmail(adminClient, email);
    if (authUserId) {
      const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(authUserId);
      if (authDeleteError) {
        return NextResponse.json({ error: authDeleteError.message }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true, message: "Account deleted successfully." });
  } catch (error) {
    console.error("Delete account error:", error);
    return NextResponse.json({ error: "Failed to delete account." }, { status: 500 });
  }
}
