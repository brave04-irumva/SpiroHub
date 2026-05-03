"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { getRiskState, getStatusStyles } from "@/utils/compliance";
import {
  UserPlus,
  ShieldCheck,
  Mail,
  Globe,
  Hash,
  Lock,
  Loader2,
  CheckCircle,
  ArrowUpRight,
  Users,
  X,
  UploadCloud,
  FileText,
  Send,
  Phone,
  BookOpen,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const CASE_TYPES = ["STUDENT_PASS", "EXTENSION", "REGULARIZATION"];

export default function DirectoryPage() {
  const searchParams = useSearchParams();
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  const [formData, setFormData] = useState({
    first_name: "",
    surname: "",
    student_id: "",
    email: "",
    password: "",
    nationality: "",
    phone: "",
    course: "",
    case_type: "STUDENT_PASS",
  });

  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [importingCSV, setImportingCSV] = useState(false);
  const [csvImportFeedback, setCsvImportFeedback] = useState("");
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [batchTitle, setBatchTitle] = useState("");
  const [sendingBatch, setSendingBatch] = useState(false);
  const [batchFeedback, setBatchFeedback] = useState("");
  const csvInputRef = useRef<HTMLInputElement>(null);

  async function fetchStudents() {
    const { data } = await supabase
      .from("students")
      .select("*, compliance_cases(*)")
      .order("created_at", { ascending: false });
    if (data) {
      const normalized = data.map((student: any) => ({
        ...student,
        compliance_cases: [...(student.compliance_cases ?? [])].sort(
          (a: any, b: any) =>
            new Date(b.updated_at ?? b.created_at ?? 0).getTime() -
            new Date(a.updated_at ?? a.created_at ?? 0).getTime(),
        ),
      }));
      setStudents(normalized);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setShowForm(true);
    }
  }, [searchParams]);

  function resetForm() {
    setFormData({ first_name: "", surname: "", student_id: "", email: "", password: "", nationality: "", phone: "", course: "", case_type: "STUDENT_PASS" });
    setError("");
    setSuccess(false);
  }

  function parseCSV(text: string): Record<string, string>[] {
    const lines = text.trim().split("\n").filter((l) => l.trim());
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase().replace(/ /g, "_"));
    return lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { row[h] = values[i] ?? ""; });
      return row;
    });
  }

  function handleCSVFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rows = parseCSV(ev.target?.result as string);
      setCsvRows(rows);
      setShowCsvModal(true);
      setCsvImportFeedback("");
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleCSVImport() {
    if (csvRows.length === 0) return;
    setImportingCSV(true);
    let ok = 0;
    let fail = 0;
    for (const row of csvRows) {
      const full_name = row.full_name ?? "";
      const student_id = row.student_id ?? row.admission_number ?? "";
      const email = row.email ?? "";
      const nationality = row.nationality ?? "";
      const phone = row.phone ?? row.phone_number ?? "";
      const course = row.course ?? "";
      const case_type = (row.case_type ?? "STUDENT_PASS").toUpperCase();
      const permit_expiry_date = row.permit_expiry_date || null;
      if (!full_name || !student_id || !email) { fail++; continue; }
      const { data: s, error: sErr } = await supabase.from("students").insert([{ full_name, student_id, email, nationality, phone: phone || null, course: course || null }]).select().single();
      if (sErr) { fail++; continue; }
      await supabase.from("compliance_cases").insert([{ student_id: s.id, case_type: CASE_TYPES.includes(case_type) ? case_type : "STUDENT_PASS", current_stage: "DOCUMENTS_PENDING", permit_expiry_date }]);
      ok++;
    }
    setCsvImportFeedback(`Imported ${ok} student${ok !== 1 ? "s" : ""}${fail > 0 ? ` (${fail} skipped)` : ""}.`);
    setImportingCSV(false);
    fetchStudents();
  }

  async function handleBatchRequest() {
    if (!batchTitle.trim()) return;
    setSendingBatch(true);
    const caseIds = filteredStudents.map((s) => s.compliance_cases?.[0]?.id).filter(Boolean);
    await Promise.all(
      caseIds.map((caseId: string) =>
        Promise.all([
          supabase.from("document_requests").insert([{ case_id: caseId, title: batchTitle.trim(), status: "PENDING" }]),
          supabase.from("case_events").insert([{ case_id: caseId, event_type: "DOC_REQUEST", description: `Batch request: "${batchTitle.trim()}"`, actor_name: "Compliance Officer" }]),
        ])
      )
    );
    setBatchFeedback(`Request sent to ${caseIds.length} student${caseIds.length !== 1 ? "s" : ""}.`);
    setSendingBatch(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!formData.email.endsWith("@daystar.ac.ke")) {
      setError("Email must be a @daystar.ac.ke address.");
      return;
    }

    if (formData.password.length < 8) {
      setError("Temporary password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setError("Session expired. Please sign in again.");
      setSubmitting(false);
      return;
    }

    const response = await fetch("/api/admin/provision-account", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        role: "STUDENT",
        first_name: formData.first_name,
        surname: formData.surname,
        email: formData.email,
        password: formData.password,
        student_id: formData.student_id,
        nationality: formData.nationality,
        phone: formData.phone,
        course: formData.course,
        case_type: formData.case_type,
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error ?? "Failed to provision student account.");
    } else {
      setSuccess(true);
      resetForm();
      fetchStudents();
      setTimeout(() => {
        setShowForm(false);
        setSuccess(false);
      }, 1800);
    }
    setSubmitting(false);
  }

  const filteredStudents = students.filter((student) => {
    const currentCase = student.compliance_cases?.[0];
    const risk = getRiskState(currentCase?.permit_expiry_date);
    const matchesRisk = riskFilter === "ALL" || risk === riskFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      q.length === 0 ||
      student.full_name?.toLowerCase().includes(q) ||
      student.student_id?.toLowerCase().includes(q) ||
      student.email?.toLowerCase().includes(q) ||
      student.nationality?.toLowerCase().includes(q);

    return matchesRisk && matchesSearch;
  });

  const PAGE_SIZE = 8;
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));
  const paginatedStudents = filteredStudents.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700 pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-5">
        <div>
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-2">
            Registry
          </p>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">
            Student Directory
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-2">
            All registered international students and their compliance status.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <input ref={csvInputRef} type="file" accept=".csv" className="hidden" onChange={handleCSVFile} />
          <button
            onClick={() => csvInputRef.current?.click()}
            className="bg-slate-100 text-slate-700 px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2"
          >
            <UploadCloud size={16} /> Import CSV
          </button>
          <button
            onClick={() => { setShowBatchModal(true); setBatchFeedback(""); setBatchTitle(""); }}
            className="bg-slate-100 text-slate-700 px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2"
          >
            <FileText size={16} /> Batch Request
          </button>
          <button
            onClick={() => { setShowForm(!showForm); resetForm(); }}
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-500/10 hover:bg-slate-900 transition-all flex items-center gap-2"
          >
            {showForm ? <><X size={16} /> Cancel</> : <><UserPlus size={16} /> Add Student</>}
          </button>
        </div>
      </div>

      {/* Add Student Form */}
      {showForm && (
        <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm animate-in slide-in-from-top-4 duration-300">
          <h2 className="font-black text-slate-900 text-[10px] uppercase tracking-widest mb-8 flex items-center gap-2">
            <UserPlus size={16} className="text-blue-600" /> Register New Student
          </h2>
          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                  <ShieldCheck size={14} /> First Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={(e) =>
                    setFormData({ ...formData, first_name: e.target.value })
                  }
                  className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-xl font-bold text-sm outline-none focus:border-blue-600 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                  <ShieldCheck size={14} /> Surname
                </label>
                <input
                  type="text"
                  required
                  value={formData.surname}
                  onChange={(e) =>
                    setFormData({ ...formData, surname: e.target.value })
                  }
                  className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-xl font-bold text-sm outline-none focus:border-blue-600 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                  <Hash size={14} /> Admission Number
                </label>
                <input
                  type="text"
                  required
                  value={formData.student_id}
                  onChange={(e) =>
                    setFormData({ ...formData, student_id: e.target.value })
                  }
                  className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-xl font-bold text-sm outline-none focus:border-blue-600 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                  <Mail size={14} /> Daystar Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="student@daystar.ac.ke"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-xl font-bold text-sm outline-none focus:border-blue-600 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                  <Lock size={14} /> Temporary Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Minimum 8 characters"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-xl font-bold text-sm outline-none focus:border-blue-600 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                  <Globe size={14} /> Nationality
                </label>
                <input
                  type="text"
                  required
                  value={formData.nationality}
                  onChange={(e) =>
                    setFormData({ ...formData, nationality: e.target.value })
                  }
                  className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-xl font-bold text-sm outline-none focus:border-blue-600 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                  <Phone size={14} /> Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="+254 7XX XXX XXX"
                  className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-xl font-bold text-sm outline-none focus:border-blue-600 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                  <BookOpen size={14} /> Course / Programme
                </label>
                <input
                  type="text"
                  value={formData.course}
                  onChange={(e) =>
                    setFormData({ ...formData, course: e.target.value })
                  }
                  placeholder="e.g. BSc Computer Science"
                  className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-xl font-bold text-sm outline-none focus:border-blue-600 transition-all"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3 px-1">
                  Case Type
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {CASE_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, case_type: type })
                      }
                      className={`py-3 rounded-xl text-[9px] font-black border-2 transition-all ${
                        formData.case_type === type
                          ? "bg-slate-900 text-white border-slate-900 shadow-lg"
                          : "bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-300"
                      }`}
                    >
                      {type.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 text-red-700 rounded-2xl text-[10px] font-black border border-red-100 uppercase tracking-wider">
                {error}
              </div>
            )}
            {success && (
              <div className="p-4 bg-emerald-50 text-emerald-700 rounded-2xl text-[10px] font-black border border-emerald-100 uppercase tracking-wider flex items-center justify-center gap-2">
                <CheckCircle size={14} /> Student account and compliance application created.
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-900 transition-all shadow-xl shadow-blue-500/10 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <>
                  <UserPlus size={18} /> Provision Student File
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* Student List */}
      <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
          <h2 className="font-black text-slate-900 text-[10px] uppercase tracking-widest flex items-center gap-2">
            <Users size={14} className="text-blue-600" /> Registry — {students.length} students
          </h2>
        </div>

        <div className="px-6 py-4 border-b border-slate-100 bg-white grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search name, admission #, email, or nationality"
            className="md:col-span-2 bg-slate-50 border-2 border-slate-100 p-3 rounded-xl font-bold text-sm outline-none focus:border-blue-600"
          />
          <select
            value={riskFilter}
            onChange={(e) => {
              setRiskFilter(e.target.value);
              setPage(1);
            }}
            className="bg-slate-50 border-2 border-slate-100 p-3 rounded-xl font-black text-xs uppercase tracking-wider outline-none focus:border-blue-600"
          >
            <option value="ALL">All Risks</option>
            <option value="EXPIRED">Expired</option>
            <option value="EXPIRING_SOON">Expiring Soon</option>
            <option value="COMPLIANT">Compliant</option>
            <option value="UNKNOWN">Unknown</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="animate-spin text-blue-600" size={32} />
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-20 text-center text-slate-400 font-bold text-sm uppercase tracking-widest">
            No students match your current filters.
          </div>
        ) : (
          <>
            <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-slate-400 uppercase text-[9px] font-black tracking-widest border-b border-slate-100">
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Admission #</th>
                  <th className="px-6 py-4">Nationality</th>
                  <th className="px-6 py-4">Case Type</th>
                  <th className="px-6 py-4">Permit Expiry</th>
                  <th className="px-6 py-4">Risk Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {paginatedStudents.map((student) => {
                const currentCase = student.compliance_cases?.[0];
                const risk = getRiskState(currentCase?.permit_expiry_date);
                const styles = getStatusStyles(risk);
                return (
                  <tr
                    key={student.id}
                    className="hover:bg-slate-50/50 transition-all"
                  >
                    <td className="px-6 py-4">
                      <div className="font-black text-slate-900">
                        {student.full_name}
                      </div>
                      <div className="text-slate-400 text-[10px] font-bold">
                        {student.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs font-bold">
                      {student.student_id}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs font-bold">
                      {student.nationality}
                    </td>
                    <td className="px-6 py-4">
                      {currentCase ? (
                        <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-lg uppercase">
                          {currentCase.case_type?.replace(/_/g, " ")}
                        </span>
                      ) : (
                        <span className="text-slate-300 text-[10px] font-bold">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs font-bold">
                      {currentCase?.permit_expiry_date || "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-3 py-1 rounded-full text-[9px] font-black uppercase border-2 ${styles}`}
                      >
                        {risk}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/directory/${student.id}`}
                        className="bg-slate-900 text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-blue-600 inline-flex items-center gap-2 transition-all"
                      >
                        Open File <ArrowUpRight size={12} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            </table>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                Showing {paginatedStudents.length} of {filteredStudents.length}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-2 rounded-lg text-[10px] font-black uppercase border border-slate-200 bg-white text-slate-600 disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider px-2">
                  Page {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-2 rounded-lg text-[10px] font-black uppercase border border-slate-200 bg-white text-slate-600 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* CSV Import Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-black text-slate-900 text-[10px] uppercase tracking-widest flex items-center gap-2">
                <UploadCloud size={16} className="text-blue-600" /> Import {csvRows.length} Students from CSV
              </h2>
              <button onClick={() => setShowCsvModal(false)} className="text-slate-400 hover:text-slate-900">
                <X size={20} />
              </button>
            </div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">
              Required columns: full_name, student_id, email, nationality — Optional: case_type, permit_expiry_date
            </p>
            <div className="overflow-auto flex-1 border border-slate-100 rounded-2xl mb-6">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 uppercase text-[9px] font-black tracking-widest">
                    {Object.keys(csvRows[0] ?? {}).map((h) => (
                      <th key={h} className="px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {csvRows.slice(0, 10).map((row, i) => (
                    <tr key={i}>
                      {Object.values(row).map((v, j) => (
                        <td key={j} className="px-4 py-2 font-bold text-slate-700">{v || "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {csvRows.length > 10 && (
                <p className="text-center text-[10px] font-black text-slate-400 uppercase py-3">
                  + {csvRows.length - 10} more rows
                </p>
              )}
            </div>
            {csvImportFeedback ? (
              <div className="p-4 bg-emerald-50 text-emerald-700 rounded-2xl text-[10px] font-black border border-emerald-100 uppercase tracking-wider flex items-center gap-2 mb-4">
                <CheckCircle size={14} /> {csvImportFeedback}
              </div>
            ) : null}
            <div className="flex gap-3">
              <button
                onClick={() => setShowCsvModal(false)}
                className="flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 border-slate-200 text-slate-500 hover:border-slate-400 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleCSVImport}
                disabled={importingCSV || !!csvImportFeedback}
                className="flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-blue-600 text-white hover:bg-slate-900 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {importingCSV ? <Loader2 className="animate-spin" size={14} /> : <UploadCloud size={14} />}
                Import {csvRows.length} Students
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Document Request Modal */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-black text-slate-900 text-[10px] uppercase tracking-widest flex items-center gap-2">
                <FileText size={16} className="text-blue-600" /> Batch Document Request
              </h2>
              <button onClick={() => setShowBatchModal(false)} className="text-slate-400 hover:text-slate-900">
                <X size={20} />
              </button>
            </div>
            <p className="text-sm font-bold text-slate-500 mb-6">
              This will send a document request to <span className="font-black text-slate-900">{filteredStudents.filter((s) => s.compliance_cases?.[0]?.id).length} student{filteredStudents.filter((s) => s.compliance_cases?.[0]?.id).length !== 1 ? "s" : ""}</span> currently visible in the directory (based on your active search/filter).
            </p>
            <div className="space-y-3 mb-6">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                Request Title
              </label>
              <input
                type="text"
                value={batchTitle}
                onChange={(e) => setBatchTitle(e.target.value)}
                placeholder="e.g. Updated Passport Copy"
                className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-xl font-bold text-sm outline-none focus:border-blue-600 transition-all"
              />
            </div>
            {batchFeedback ? (
              <div className="p-4 bg-emerald-50 text-emerald-700 rounded-2xl text-[10px] font-black border border-emerald-100 uppercase tracking-wider flex items-center gap-2 mb-4">
                <CheckCircle size={14} /> {batchFeedback}
              </div>
            ) : null}
            <div className="flex gap-3">
              <button
                onClick={() => setShowBatchModal(false)}
                className="flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 border-slate-200 text-slate-500 hover:border-slate-400 transition-all"
              >
                Close
              </button>
              <button
                onClick={handleBatchRequest}
                disabled={sendingBatch || !batchTitle.trim() || !!batchFeedback}
                className="flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-blue-600 text-white hover:bg-slate-900 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {sendingBatch ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                Send Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
