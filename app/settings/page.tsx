"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  ShieldCheck,
  UserPlus,
  Loader2,
  Lock,
  Trash2,
  Megaphone,
  Shield,
  ToggleLeft,
  ToggleRight,
  Plus,
} from "lucide-react";

export default function SettingsPage() {
  const [officers, setOfficers] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [newAnnouncement, setNewAnnouncement] = useState("");
  const [savingAnnouncement, setSavingAnnouncement] = useState(false);
  const [officerCanDelete, setOfficerCanDelete] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);

  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("OFFICER");
  const [newPassword, setNewPassword] = useState("");
  const [newStudentId, setNewStudentId] = useState("");
  const [newNationality, setNewNationality] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newCourse, setNewCourse] = useState("");
  const [feedbackError, setFeedbackError] = useState("");
  const [feedbackSuccess, setFeedbackSuccess] = useState("");

  const authorizedAccounts = [...officers, ...students]
    .map((item) => {
      if (item.role) {
        return {
          kind: "OFFICER",
          id: item.id,
          full_name: item.full_name,
          email: item.email,
          role: item.role,
          student_id: null,
          created_at: item.created_at,
        };
      }
      return {
        kind: "STUDENT",
        id: item.id,
        full_name: item.full_name,
        email: item.email,
        role: "STUDENT",
        student_id: item.student_id,
        created_at: item.created_at,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

  async function checkPermissionsAndFetch() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const { data: officer } = await supabase
      .from("officers")
      .select("role")
      .eq("email", session?.user?.email ?? "")
      .single();

    if (officer?.role === "ADMIN") {
      setIsAdmin(true);
      const [officersRes, studentsRes] = await Promise.all([
        supabase
          .from("officers")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("students")
          .select("id, full_name, student_id, email, nationality, phone, course, created_at")
          .order("created_at", { ascending: false }),
      ]);
      if (officersRes.data) setOfficers(officersRes.data);
      if (studentsRes.data) setStudents(studentsRes.data);

      // Announcements
      try {
        const { data: ann } = await supabase
          .from("announcements")
          .select("*")
          .order("created_at", { ascending: false });
        if (ann) setAnnouncements(ann);
      } catch { /* table not yet created */ }

      // System settings / permissions
      try {
        const { data: setting } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "officer_can_delete_students")
          .single();
        if (setting) setOfficerCanDelete(setting.value === "true");
      } catch { /* table not yet created */ }
    }
    setLoading(false);
  }

  useEffect(() => {
    checkPermissionsAndFetch();
  }, []);

  async function handleProvisionAccount(e: React.FormEvent) {
    e.preventDefault();
    setFeedbackError("");
    setFeedbackSuccess("");

    if (!newEmail.endsWith("@daystar.ac.ke")) {
      setFeedbackError("Email must be a @daystar.ac.ke domain.");
      return;
    }

    if (newPassword.length < 8) {
      setFeedbackError("Password must be at least 8 characters.");
      return;
    }

    if (newRole === "STUDENT" && !newStudentId.trim()) {
      setFeedbackError("Admission Number is required for student accounts.");
      return;
    }

    setIsAdding(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setFeedbackError("Your session expired. Please sign in again.");
      setIsAdding(false);
      return;
    }

    const res = await fetch("/api/admin/provision-account", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        full_name: newName,
        email: newEmail,
        role: newRole,
        password: newPassword,
        student_id: newStudentId.trim(),
        nationality: newNationality,
        phone: newPhone,
        course: newCourse,
      }),
    });

    const payload = await res.json();

    if (!res.ok) {
      setFeedbackError(payload.error ?? "Failed to provision account.");
      setIsAdding(false);
      return;
    }

    setNewName("");
    setNewEmail("");
    setNewPassword("");
    setNewStudentId("");
    setNewNationality("");
    setNewPhone("");
    setNewCourse("");
    setFeedbackSuccess(payload.message ?? "Account provisioned successfully.");
    checkPermissionsAndFetch();

    setIsAdding(false);
  }

  async function handleDeleteAccount(account: any) {
    if (
      !confirm(
        `Are you sure you want to delete ${account.full_name} (${account.role})? This action is final.`,
      )
    )
      return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      alert("Session expired. Please sign in again.");
      return;
    }

    const res = await fetch("/api/admin/delete-account", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        role: account.role,
        id: account.id,
        email: account.email,
      }),
    });
    const payload = await res.json();
    if (!res.ok) {
      alert(payload.error ?? "Failed to delete account.");
      return;
    }
    checkPermissionsAndFetch();
  }

  if (loading)
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );

  if (!isAdmin)
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] space-y-6">
        <div className="bg-red-50 p-10 rounded-[2rem] border-2 border-red-100 flex flex-col items-center">
          <Lock size={48} className="text-red-500 mb-6" />
          <h1 className="text-2xl font-black text-slate-900 uppercase">
            Unauthorized{" "}
          </h1>
          <p className="text-slate-500 font-bold text-xs mt-2 uppercase tracking-widest text-center">
            Settings are restricted to the Admin.
          </p>
        </div>
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500 pb-8">
      <div>
        <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-2">
          Access Control
        </p>
        <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">
          System Governance
        </h1>
        <p className="text-slate-500 font-medium text-sm mt-2">
          Role-based access control and staff provisioning.{" "}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">
        <div className="bg-white border border-slate-200 rounded-[2rem] p-7 shadow-sm">
          <h3 className="font-black text-slate-900 uppercase tracking-widest text-[10px] mb-8 flex items-center gap-2">
            <UserPlus size={16} className="text-blue-600" /> Create Account
          </h3>

          <div className="mb-6 p-4 rounded-2xl border border-amber-100 bg-amber-50 text-amber-800 text-[11px] font-semibold leading-relaxed">
            This form creates both Supabase login credentials and the matching
            profile record in one action.
          </div>

          {feedbackError && (
            <div className="mb-4 p-4 rounded-2xl border border-red-100 bg-red-50 text-red-700 text-xs font-bold">
              {feedbackError}
            </div>
          )}

          {feedbackSuccess && (
            <div className="mb-4 p-4 rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-700 text-xs font-bold">
              {feedbackSuccess}
            </div>
          )}

          <form onSubmit={handleProvisionAccount} className="space-y-4">
            <input
              type="text"
              placeholder="Full Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-xl font-bold text-sm outline-none focus:border-blue-600"
              required
            />
            <input
              type="email"
              placeholder="name@daystar.ac.ke"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-xl font-bold text-sm outline-none focus:border-blue-600"
              required
            />
            <input
              type="password"
              placeholder="Temporary Password (min 8 chars)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-xl font-bold text-sm outline-none focus:border-blue-600"
              required
              minLength={8}
            />
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-xl font-bold text-sm outline-none focus:border-blue-600"
            >
              <option value="OFFICER">OFFICER</option>
              <option value="ADMIN">ADMIN</option>
              <option value="STUDENT">STUDENT</option>
            </select>
            {newRole === "STUDENT" && (
              <>
                <input
                  type="text"
                  placeholder="Admission Number"
                  value={newStudentId}
                  onChange={(e) => setNewStudentId(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-xl font-bold text-sm outline-none focus:border-blue-600"
                  required
                />
                <input
                  type="text"
                  placeholder="Nationality"
                  value={newNationality}
                  onChange={(e) => setNewNationality(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-xl font-bold text-sm outline-none focus:border-blue-600"
                />
                <input
                  type="text"
                  placeholder="Phone Number (optional)"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-xl font-bold text-sm outline-none focus:border-blue-600"
                />
                <input
                  type="text"
                  placeholder="Course / Programme (optional)"
                  value={newCourse}
                  onChange={(e) => setNewCourse(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-xl font-bold text-sm outline-none focus:border-blue-600"
                />
              </>
            )}
            <button
              type="submit"
              disabled={isAdding}
              className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-all"
            >
              {isAdding ? (
                <Loader2 className="animate-spin mx-auto" size={18} />
              ) : (
                newRole === "STUDENT"
                  ? "Provision Student Profile"
                  : "Provision Account"
              )}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60">
            <h3 className="font-black text-slate-900 uppercase tracking-widest text-[10px] flex items-center gap-2">
              <ShieldCheck size={16} className="text-blue-600" /> Authorized
              Personnel
            </h3>
          </div>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 uppercase text-[9px] font-black tracking-widest">
                <th className="px-6 py-3">Account</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Reference</th>
                <th className="px-6 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {authorizedAccounts.map((account) => (
                <tr key={`${account.kind}_${account.id}`} className="hover:bg-slate-50 transition-all">
                  <td className="px-6 py-5">
                    <div className="font-black text-slate-900">
                      {account.full_name}
                    </div>
                    <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                      {account.email}
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <span
                      className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase border ${
                        account.role === "ADMIN"
                          ? "bg-purple-50 text-purple-700 border-purple-100"
                          : account.role === "OFFICER"
                            ? "bg-blue-50 text-blue-700 border-blue-100"
                            : "bg-emerald-50 text-emerald-700 border-emerald-100"
                      }`}
                    >
                      {account.role}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    {account.role === "STUDENT" ? account.student_id ?? "—" : "Staff"}
                  </td>
                  <td className="px-6 py-5 text-right">
                    {account.email !== "admin@daystar.ac.ke" && (
                      <button
                        onClick={() => handleDeleteAccount(account)}
                        className="text-slate-300 hover:text-red-500 transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Announcements Management */}
      <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
          <Megaphone size={16} className="text-blue-600" />
          <h3 className="font-black text-slate-900 uppercase tracking-widest text-[10px]">
            System Announcements
          </h3>
        </div>
        <div className="p-7 space-y-6">
          {/* Create new announcement */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newAnnouncement.trim()) return;
              setSavingAnnouncement(true);
              const { data: { session } } = await supabase.auth.getSession();
              await supabase.from("announcements").insert([{
                message: newAnnouncement.trim(),
                created_by: session?.user?.email ?? "Admin",
              }]);
              setNewAnnouncement("");
              const { data: ann } = await supabase.from("announcements").select("*").order("created_at", { ascending: false });
              if (ann) setAnnouncements(ann);
              setSavingAnnouncement(false);
            }}
            className="flex gap-3"
          >
            <textarea
              value={newAnnouncement}
              onChange={(e) => setNewAnnouncement(e.target.value)}
              placeholder="Type an announcement to broadcast to all students…"
              rows={2}
              className="flex-1 bg-slate-50 border-2 border-slate-100 px-4 py-3 rounded-2xl font-medium text-sm outline-none focus:border-blue-600 transition-all resize-none"
            />
            <button
              type="submit"
              disabled={savingAnnouncement || !newAnnouncement.trim()}
              className="bg-blue-600 text-white px-5 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-900 disabled:opacity-40 transition-all flex items-center gap-2 shrink-0"
            >
              <Plus size={14} /> Post
            </button>
          </form>

          {announcements.length === 0 ? (
            <p className="text-slate-400 text-sm font-medium text-center py-4">No announcements yet.</p>
          ) : (
            <div className="space-y-3">
              {announcements.map((a) => (
                <div key={a.id} className={`flex items-start justify-between gap-4 p-4 rounded-2xl border ${a.is_active ? "bg-blue-50 border-blue-100" : "bg-slate-50 border-slate-100 opacity-60"}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{a.message}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
                      {new Date(a.created_at).toLocaleDateString()} · by {a.created_by}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={async () => {
                        await supabase.from("announcements").update({ is_active: !a.is_active }).eq("id", a.id);
                        setAnnouncements((prev) => prev.map((x) => x.id === a.id ? { ...x, is_active: !x.is_active } : x));
                      }}
                      className="text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 transition-all"
                    >
                      {a.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      onClick={async () => {
                        if (!confirm("Delete this announcement?")) return;
                        await supabase.from("announcements").delete().eq("id", a.id);
                        setAnnouncements((prev) => prev.filter((x) => x.id !== a.id));
                      }}
                      className="text-slate-300 hover:text-red-500 transition-all"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60">
          <h3 className="font-black text-slate-900 uppercase tracking-widest text-[10px] flex items-center gap-2">
            <ShieldCheck size={16} className="text-blue-600" /> Registered Students
          </h3>
        </div>
        {students.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm font-bold">
            No student profiles found yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase text-[9px] font-black tracking-widest">
                  <th className="px-6 py-3">Student</th>
                  <th className="px-6 py-3">Admission #</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Nationality</th>
                  <th className="px-6 py-3">Phone</th>
                  <th className="px-6 py-3">Course</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50 transition-all">
                    <td className="px-6 py-4 font-black text-slate-900">{student.full_name}</td>
                    <td className="px-6 py-4 text-slate-600 font-bold text-xs">{student.student_id}</td>
                    <td className="px-6 py-4 text-slate-600 font-bold text-xs">{student.email}</td>
                    <td className="px-6 py-4 text-slate-600 font-bold text-xs">{student.nationality || "—"}</td>
                    <td className="px-6 py-4 text-slate-600 font-bold text-xs">{student.phone || "—"}</td>
                    <td className="px-6 py-4 text-slate-600 font-bold text-xs">{student.course || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Role Permissions Matrix */}
      <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center gap-2">
          <Shield size={16} className="text-blue-600" />
          <h3 className="font-black text-slate-900 uppercase tracking-widest text-[10px]">
            Role Permissions Matrix
          </h3>
        </div>
        <div className="p-7 space-y-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Capability</th>
                  <th className="pb-3 px-6 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Admin</th>
                  <th className="pb-3 px-6 text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Officer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {[
                  { label: "View all student cases", admin: true, officer: true, fixed: true },
                  { label: "Create document requests", admin: true, officer: true, fixed: true },
                  { label: "Advance case stages", admin: true, officer: true, fixed: true },
                  { label: "Export CSV reports", admin: true, officer: true, fixed: true },
                  { label: "Create officer accounts", admin: true, officer: false, fixed: true },
                  { label: "View audit log", admin: true, officer: false, fixed: true },
                  { label: "Manage announcements", admin: true, officer: false, fixed: true },
                  { label: "Delete student cases", admin: true, officer: null, fixed: false, key: "delete_students" },
                ].map((row) => (
                  <tr key={row.label}>
                    <td className="py-3.5 text-sm font-medium text-slate-700">{row.label}</td>
                    <td className="py-3.5 px-6 text-center">
                      <span className="text-emerald-500 text-base font-black">✓</span>
                    </td>
                    <td className="py-3.5 px-6 text-center">
                      {row.fixed ? (
                        row.officer ? (
                          <span className="text-emerald-500 text-base font-black">✓</span>
                        ) : (
                          <span className="text-slate-300 text-base font-black">—</span>
                        )
                      ) : (
                        <button
                          onClick={async () => {
                            const next = !officerCanDelete;
                            setSavingPermissions(true);
                            await supabase.from("system_settings").upsert({ key: "officer_can_delete_students", value: String(next), updated_at: new Date().toISOString() });
                            setOfficerCanDelete(next);
                            setSavingPermissions(false);
                          }}
                          disabled={savingPermissions}
                          className="flex items-center gap-1.5 mx-auto text-[9px] font-black uppercase tracking-widest transition-all"
                        >
                          {officerCanDelete ? (
                            <><ToggleRight size={22} className="text-blue-600" /><span className="text-blue-600">On</span></>
                          ) : (
                            <><ToggleLeft size={22} className="text-slate-300" /><span className="text-slate-400">Off</span></>
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-slate-400 font-medium">Toggleable permissions are stored in the database and applied system-wide.</p>
        </div>
      </div>
    </div>
  );
}
