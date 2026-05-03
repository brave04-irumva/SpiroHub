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
    const firstName = String(body.first_name || "").trim();
    const surname = String(body.surname || "").trim();
    const fallbackFullName = String(body.full_name || "").trim();
    const fullName = [firstName, surname].filter(Boolean).join(" ") || fallbackFullName;
    const email = String(body.email || "").trim().toLowerCase();
    const role = String(body.role || "").trim().toUpperCase();
    const password = String(body.password || "");

    if (!fullName || !email || !role) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    if (!email.endsWith("@daystar.ac.ke")) {
      return NextResponse.json({ error: "Email must be a @daystar.ac.ke domain." }, { status: 400 });
    }

    if (!["ADMIN", "OFFICER", "STUDENT"].includes(role)) {
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    }

    const actorRole = actor?.role;
    const canManageStudents = actorRole === "ADMIN" || actorRole === "OFFICER";
    const canManageStaff = actorRole === "ADMIN";

    if (role === "STUDENT" && !canManageStudents) {
      return NextResponse.json({ error: "Permission denied." }, { status: 403 });
    }

    if (role !== "STUDENT" && !canManageStaff) {
      return NextResponse.json({ error: "Admin permission required for staff accounts." }, { status: 403 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    if (role === "STUDENT") {
      const studentId = String(body.student_id || "").trim();
      const nationality = String(body.nationality || "").trim() || "Unknown";
      const phone = String(body.phone || "").trim();
      const course = String(body.course || "").trim();
      const caseType = String(body.case_type || "STUDENT_PASS").trim().toUpperCase();
      const nameParts = fullName.split(/\s+/).filter(Boolean);
      const safeFirstName = firstName || nameParts[0] || "";
      const safeSurname = surname || nameParts.slice(1).join(" ");
      const safeFullName = [safeFirstName, safeSurname].filter(Boolean).join(" ").trim();

      if (!safeFirstName || !safeSurname) {
        return NextResponse.json(
          { error: "First Name and Surname are required for student accounts." },
          { status: 400 },
        );
      }

      if (!studentId) {
        return NextResponse.json(
          { error: "Admission Number is required for student accounts." },
          { status: 400 },
        );
      }

      const allowedCaseTypes = ["STUDENT_PASS", "REGULARIZATION", "EXTENSION"];
      const safeCaseType = allowedCaseTypes.includes(caseType)
        ? caseType
        : "STUDENT_PASS";

      const { data: existingStudents, error: existingSearchError } = await adminClient
        .from("students")
        .select("id, full_name, student_id, email")
        .or(`email.eq.${email},student_id.eq.${studentId}`)
        .limit(1);

      if (existingSearchError) {
        return NextResponse.json({ error: existingSearchError.message }, { status: 400 });
      }

      let targetStudentId: string | null = null;
      let reusedStudent = false;

      if (existingStudents && existingStudents.length > 0) {
        targetStudentId = existingStudents[0].id;
        reusedStudent = true;

        const { error: updateStudentError } = await adminClient
          .from("students")
          .update({
            full_name: safeFullName,
            student_id: studentId,
            email,
            nationality,
            phone: phone || null,
            course: course || null,
          })
          .eq("id", targetStudentId);

        const { error: ensureAuthError } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: safeFullName,
            role,
          },
        });

        if (
          ensureAuthError &&
          !ensureAuthError.message.toLowerCase().includes("already")
        ) {
          return NextResponse.json({ error: ensureAuthError.message }, { status: 400 });
        }

        if (updateStudentError) {
          return NextResponse.json({ error: updateStudentError.message }, { status: 400 });
        }
      } else {
        const { error: createAuthError } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: safeFullName,
            role,
          },
        });

        if (
          createAuthError &&
          !createAuthError.message.toLowerCase().includes("already")
        ) {
          return NextResponse.json({ error: createAuthError.message }, { status: 400 });
        }

        const { data: insertedStudent, error: studentInsertError } = await adminClient
          .from("students")
          .insert([
            {
              full_name: safeFullName,
              student_id: studentId,
              email,
              nationality,
              phone: phone || null,
              course: course || null,
            },
          ])
          .select("id")
          .single();

        if (studentInsertError || !insertedStudent?.id) {
          return NextResponse.json(
            { error: studentInsertError?.message ?? "Failed to create student profile." },
            { status: 400 },
          );
        }

        targetStudentId = insertedStudent.id;
      }

      const { data: newCase, error: caseInsertError } = await adminClient
        .from("compliance_cases")
        .insert([
          {
            student_id: targetStudentId,
            case_type: safeCaseType,
            current_stage: "DOCUMENTS_PENDING",
          },
        ])
        .select("id")
        .single();

      if (caseInsertError) {
        return NextResponse.json({ error: caseInsertError.message }, { status: 400 });
      }

      await adminClient.from("case_events").insert([
        {
          case_id: newCase?.id,
          event_type: "CASE_CREATED",
          description: reusedStudent
            ? `New ${safeCaseType.replace(/_/g, " ")} application opened for existing student.`
            : `Student registered and ${safeCaseType.replace(/_/g, " ")} application opened.`,
          actor_name: user.email,
        },
      ]);

      return NextResponse.json({
        success: true,
        message: reusedStudent
          ? "Existing student reused. New compliance application created successfully."
          : "Student login, profile, and compliance application created successfully.",
      });
    }

    const {
      data: createdAuth,
      error: createAuthError,
    } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role,
      },
    });

    if (createAuthError) {
      return NextResponse.json({ error: createAuthError.message }, { status: 400 });
    }

    const { error: officerInsertError } = await adminClient.from("officers").insert([
      {
        full_name: fullName,
        email,
        role,
      },
    ]);

    if (officerInsertError) {
      if (createdAuth.user?.id) {
        await adminClient.auth.admin.deleteUser(createdAuth.user.id);
      }
      return NextResponse.json({ error: officerInsertError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Staff login and role profile created successfully." });
  } catch (error) {
    console.error("Provision account error:", error);
    return NextResponse.json({ error: "Failed to provision account." }, { status: 500 });
  }
}
