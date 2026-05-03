import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { studentId } = await req.json();

  if (!studentId || typeof studentId !== "string") {
    return NextResponse.json({ error: "Missing studentId" }, { status: 400 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  // Service role client bypasses RLS — only used server-side, never exposed to browser
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  );

  const { data, error } = await adminClient
    .from("students")
    .select("email")
    .eq("student_id", studentId.trim())
    .single();

  if (error || !data) {
    // Return a generic error so admission numbers can't be enumerated
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Return only the email — no other student data
  return NextResponse.json({ email: data.email });
}
