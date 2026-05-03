"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { getRiskState, getStatusStyles } from "@/utils/compliance";
import { useRouter } from "next/navigation";
import {
  Calendar,
  ArrowRight,
  User,
  ShieldAlert,
  CheckCircle,
  Loader2,
  Upload,
  Trash2,
  UserPen,
  FileText,
  Plus,
  ExternalLink,
  Printer,
} from "lucide-react";

const CASE_TYPE_DOCS: Record<string, string[]> = {
  STUDENT_PASS: [
    "Passport Photo", "Bio Data Page", "Cover Letter", "High School Certificate(s)",
    "Immigration Status", "Police Clearance Certificate (Birth Country)",
    "Sponsor's Letter", "Sponsor's Passport Photo", "General Charter", "Form 30",
  ],
  REGULARIZATION: [
    "Passport Photo", "Bio Data Page", "Cover Letter", "High School Certificate(s)",
    "Immigration Status", "Police Clearance Certificate (Birth Country)",
    "Sponsor's Letter", "Sponsor's Passport Photo", "General Charter", "Form 30",
  ],
  EXTENSION: [
    "Passport Photo", "Bio Data Page", "Cover Letter", "High School Certificate(s)",
    "University Transcript", "KPP (Kenya Pupil's Pass)", "Immigration Status",
    "Police Clearance Certificate (DCI)", "Sponsor's Letter", "Sponsor's Passport Photo",
    "General Charter", "Form 30",
  ],
};

export default function CaseDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = React.use(params);
  const studentId = resolvedParams.id;
  const router = useRouter();

  const [data, setData] = useState<any>(null);
  const [docs, setDocs] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editId, setEditId] = useState("");
  const [editNationality, setEditNationality] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCourse, setEditCourse] = useState("");
  const [showChecklist, setShowChecklist] = useState(false);

  const [actorName, setActorName] = useState("Officer");
  const [newRequestTitle, setNewRequestTitle] = useState("");
  const [newRequestDueDate, setNewRequestDueDate] = useState("");
  const [noteText, setNoteText] = useState("");
  const [clearingLog, setClearingLog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) {
        supabase
          .from("officers")
          .select("full_name")
          .eq("email", session.user.email)
          .single()
          .then(({ data }) => {
            if (data?.full_name) setActorName(data.full_name);
          });
      }
    });
  }, []);

  async function fetchData() {
    const { data: student } = await supabase
      .from("students")
      .select("*")
      .eq("id", studentId)
      .single();

    if (student) {
      const { data: cases } = await supabase
        .from("compliance_cases")
        .select("*")
        .eq("student_id", studentId)
        .order("updated_at", { ascending: false });

      const normalizedStudent = {
        ...student,
        compliance_cases: cases ?? [],
      };
      const caseId = normalizedStudent.compliance_cases[0]?.id;
      const [docsRes, eventsRes, requestsRes] = await Promise.all([
        supabase.from("documents").select("*").eq("case_id", caseId),
        supabase
          .from("case_events")
          .select("*")
          .eq("case_id", caseId)
          .order("created_at", { ascending: false }),
        supabase
          .from("document_requests")
          .select("*")
          .eq("case_id", caseId)
          .order("created_at", { ascending: false }),
      ]);
      setData(normalizedStudent);
      setEditName(normalizedStudent.full_name);
      setEditId(normalizedStudent.student_id);
      setEditNationality(normalizedStudent.nationality);
      setEditEmail(normalizedStudent.email);
      setEditPhone(normalizedStudent.phone ?? "");
      setEditCourse(normalizedStudent.course ?? "");
      if (docsRes.data) setDocs(docsRes.data);
      if (eventsRes.data) setEvents(eventsRes.data);
      if (requestsRes.data) setRequests(requestsRes.data);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (studentId) fetchData();
  }, [studentId]);

  async function handleUpdateStudentInfo() {
    if (!editEmail.endsWith("@daystar.ac.ke")) {
      alert("Constraint Violation: Email must be @daystar.ac.ke");
      return;
    }
    setUpdating(true);
    const { error } = await supabase
      .from("students")
      .update({
        full_name: editName,
        student_id: editId,
        nationality: editNationality,
        email: editEmail,
        phone: editPhone || null,
        course: editCourse || null,
      })
      .eq("id", studentId);

    if (!error) {
      await supabase.from("case_events").insert([
        {
          case_id: data.compliance_cases[0].id,
          event_type: "UPDATE",
          description: "Modified student profile",
          actor_name: actorName,
        },
      ]);
      setIsEditing(false);
      fetchData();
    }
    setUpdating(false);
  }

  async function handleDeleteStudent() {
    if (!confirm("CRITICAL ACTION: Permanently delete this student file?"))
      return;
    setUpdating(true);
    const { error } = await supabase
      .from("students")
      .delete()
      .eq("id", studentId);
    if (!error) router.push("/directory");
    setUpdating(false);
  }

  async function handleUpdate(field: string, value: string) {
    if (!data?.compliance_cases?.[0]) return;
    setUpdating(true);
    await supabase
      .from("compliance_cases")
      .update({ [field]: value })
      .eq("id", data.compliance_cases[0].id);
    await supabase.from("case_events").insert([
      {
        case_id: data.compliance_cases[0].id,
        event_type: "UPDATE",
        description: `Updated ${field.replace(/_/g, " ")} to "${value}"`,
        actor_name: actorName,
      },
    ]);
    fetchData();
    setUpdating(false);
  }

  async function handleAddDocumentRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!newRequestTitle.trim() || !data?.compliance_cases?.[0]) return;
    setUpdating(true);
    await supabase.from("document_requests").insert([
      {
        case_id: data.compliance_cases[0].id,
        title: newRequestTitle.trim(),
        status: "PENDING",
        due_date: newRequestDueDate || null,
      },
    ]);
    await supabase.from("case_events").insert([
      {
        case_id: data.compliance_cases[0].id,
        event_type: "DOC_REQUEST",
        description: `Document requested: "${newRequestTitle.trim()}"${
          newRequestDueDate ? ` (due ${newRequestDueDate})` : ""
        }`,
        actor_name: actorName,
      },
    ]);
    setNewRequestTitle("");
    setNewRequestDueDate("");
    fetchData();
    setUpdating(false);
  }

  async function handlePostNote() {
    if (!noteText.trim() || !data?.compliance_cases?.[0]) return;
    setUpdating(true);
    await supabase.from("case_events").insert([
      {
        case_id: data.compliance_cases[0].id,
        event_type: "NOTE",
        description: noteText.trim(),
        actor_name: actorName,
      },
    ]);
    setNoteText("");
    fetchData();
    setUpdating(false);
  }

  async function addChecklistDoc(title: string) {
    if (!data?.compliance_cases?.[0]) return;
    setUpdating(true);
    await supabase.from("document_requests").insert([{ case_id: data.compliance_cases[0].id, title, status: "PENDING" }]);
    await supabase.from("case_events").insert([{ case_id: data.compliance_cases[0].id, event_type: "DOC_REQUEST", description: `Document requested: "${title}"`, actor_name: actorName }]);
    fetchData();
    setUpdating(false);
  }

  async function addAllChecklistDocs(docs: string[]) {
    if (!data?.compliance_cases?.[0]) return;
    setUpdating(true);
    const existing = new Set(requests.map((r: any) => r.title));
    const toAdd = docs.filter((d) => !existing.has(d));
    if (toAdd.length === 0) { setUpdating(false); return; }
    await Promise.all(toAdd.map((title) =>
      supabase.from("document_requests").insert([{ case_id: data.compliance_cases[0].id, title, status: "PENDING" }])
    ));
    await supabase.from("case_events").insert([{ case_id: data.compliance_cases[0].id, event_type: "DOC_REQUEST", description: `Standard checklist applied: ${toAdd.length} document${toAdd.length !== 1 ? "s" : ""} requested`, actor_name: actorName }]);
    fetchData();
    setUpdating(false);
  }

  async function handleFulfillRequest(requestId: string, title: string) {
    setUpdating(true);
    await supabase
      .from("document_requests")
      .update({ status: "FULFILLED" })
      .eq("id", requestId);
    await supabase.from("case_events").insert([
      {
        case_id: data.compliance_cases[0].id,
        event_type: "UPDATE",
        description: `Document request fulfilled: "${title}"`,
        actor_name: actorName,
      },
    ]);
    fetchData();
    setUpdating(false);
  }

  async function handleClearLog() {
    if (!data?.compliance_cases?.[0]) return;
    if (!confirm("Clear the entire officer log for this case? This cannot be undone.")) return;
    setClearingLog(true);
    await supabase
      .from("case_events")
      .delete()
      .eq("case_id", data.compliance_cases[0].id);
    fetchData();
    setClearingLog(false);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !data?.compliance_cases?.[0]) return;

    const MAX_MB = 10;
    if (file.size > MAX_MB * 1024 * 1024) {
      alert(`File exceeds ${MAX_MB}MB limit.`);
      return;
    }
    const ALLOWED = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];
    if (!ALLOWED.includes(file.type)) {
      alert("Only PDF, JPG, PNG, or WEBP files are allowed.");
      return;
    }

    setUploading(true);
    const caseId = data.compliance_cases[0].id;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `cases/${caseId}/${Date.now()}_${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from("compliance_vault")
      .upload(path, file);

    if (uploadError) {
      alert(`Upload failed: ${uploadError.message}`);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("compliance_vault")
      .getPublicUrl(path);

    await supabase.from("documents").insert([
      {
        case_id: caseId,
        file_name: file.name,
        file_url: urlData.publicUrl,
      },
    ]);
    await supabase.from("case_events").insert([
      {
        case_id: caseId,
        event_type: "DOCUMENT_UPLOADED",
        description: `Officer ${actorName} uploaded "${file.name}" on behalf of the student.`,
        actor_name: actorName,
      },
    ]);

    if (fileInputRef.current) fileInputRef.current.value = "";
    fetchData();
    setUploading(false);
  }

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  if (!data)
    return (
      <div className="p-20 text-center font-black text-slate-400">
        Student file not found.
      </div>
    );

  const currentCase = data.compliance_cases[0];
  const risk = getRiskState(currentCase?.permit_expiry_date);
  const riskStyles = getStatusStyles(risk);
  const workflowStages = [
    "DOCUMENTS_PENDING",
    "DOCUMENT_SUBMITTED",
    "PAYMENT_MADE",
    "SUBMITTED_TO_IMMIGRATION",
    "AWAITING_COLLECTION",
    "PASSPORT_COLLECTED",
  ];
  const currentStageIndex = workflowStages.indexOf(currentCase?.current_stage);

  const checklistForCase = CASE_TYPE_DOCS[currentCase?.case_type ?? ""] ?? [];
  const existingRequestTitles = new Set(requests.map((r: any) => r.title));
  const missingChecklistItems = checklistForCase.filter((d: string) => !existingRequestTitles.has(d));

  async function handleAdvanceStage() {
    if (currentStageIndex < 0 || currentStageIndex >= workflowStages.length - 1) {
      return;
    }
    await handleUpdate("current_stage", workflowStages[currentStageIndex + 1]);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-14 px-4">
      {/* Student Header */}
      <div className="bg-white border border-slate-200 rounded-[2rem] p-7 shadow-sm flex flex-col md:flex-row items-center justify-between gap-7 relative overflow-hidden">
        <div className="flex items-center gap-8 flex-col md:flex-row text-center md:text-left w-full">
          <div className="h-20 w-20 bg-slate-900 rounded-[1.5rem] flex items-center justify-center text-white shadow-xl shrink-0">
            <User size={40} />
          </div>
          <div className="flex-1">
            {isEditing ? (
              <div className="space-y-3 w-full">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="bg-slate-50 border-2 border-slate-200 p-3 rounded-xl font-black text-xl w-full"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={editId}
                    onChange={(e) => setEditId(e.target.value)}
                    placeholder="Admission #"
                    className="bg-slate-50 border-2 border-slate-200 p-2 rounded-lg text-[10px] font-black"
                  />
                  <input
                    value={editNationality}
                    onChange={(e) => setEditNationality(e.target.value)}
                    placeholder="Nationality"
                    className="bg-slate-50 border-2 border-slate-200 p-2 rounded-lg text-[10px] font-black"
                  />
                </div>
                <input
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="University Email"
                  className="bg-slate-50 border-2 border-slate-200 p-3 rounded-xl text-xs font-black w-full"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="Phone number"
                    className="bg-slate-50 border-2 border-slate-200 p-2 rounded-lg text-[10px] font-black"
                  />
                  <input
                    value={editCourse}
                    onChange={(e) => setEditCourse(e.target.value)}
                    placeholder="Course / Programme"
                    className="bg-slate-50 border-2 border-slate-200 p-2 rounded-lg text-[10px] font-black"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleUpdateStudentInfo}
                    disabled={updating}
                    className="text-[9px] font-black uppercase bg-blue-600 text-white px-6 py-2.5 rounded-lg shadow-lg disabled:opacity-50"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="text-[9px] font-black uppercase bg-slate-100 text-slate-400 px-6 py-2.5 rounded-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">
                  {data.full_name}
                </h1>
                <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">
                  {data.student_id} · {data.nationality} · {data.email}
                </p>
                {(data.phone || data.course) && (
                  <p className="text-slate-400 text-xs font-medium mt-0.5">
                    {[data.phone, data.course].filter(Boolean).join(" · ")}
                  </p>
                )}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-1.5 bg-slate-100 text-slate-500 px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-blue-50 hover:text-blue-600 transition-all"
                  >
                    <UserPen size={14} /> Edit Profile
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="flex items-center gap-1.5 bg-slate-100 text-slate-500 px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-blue-50 hover:text-blue-600 transition-all print:hidden"
                  >
                    <Printer size={14} /> Print Case File
                  </button>
                  <button
                    onClick={handleDeleteStudent}
                    className="flex items-center gap-1.5 bg-red-50 text-red-500 px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
                  >
                    <Trash2 size={14} /> Delete File
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
        <div
          className={`px-8 py-3 rounded-2xl border-4 font-black text-[11px] uppercase tracking-tighter shadow-inner shrink-0 ${riskStyles}`}
        >
          {risk?.replace(/_/g, " ")} STATUS
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-8">
          {/* Workflow Process */}
          <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm p-7">
            <div className="flex items-center justify-between mb-8 gap-4">
              <h3 className="font-black text-slate-900 uppercase tracking-widest text-[10px]">
                Workflow Process
              </h3>
              <button
                onClick={handleAdvanceStage}
                disabled={
                  updating ||
                  currentStageIndex < 0 ||
                  currentStageIndex >= workflowStages.length - 1
                }
                className="bg-blue-600 text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-900 transition-all disabled:opacity-40"
              >
                Advance to Next Stage
              </button>
            </div>
            <div className="space-y-4">
              {workflowStages.map((stage, index) => {
                const isActive = currentCase?.current_stage === stage;
                const isCompleted =
                  currentStageIndex >= 0 && index < currentStageIndex;
                return (
                  <button
                    key={stage}
                    disabled={updating}
                    onClick={() => handleUpdate("current_stage", stage)}
                    className={`w-full text-left px-6 py-5 rounded-2xl border-2 transition-all flex justify-between items-center group ${
                      isCompleted
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : isActive
                        ? "border-blue-600 bg-blue-50 text-blue-700 shadow-xl"
                        : "border-slate-100 text-slate-400 hover:border-slate-300"
                    }`}
                  >
                    <span className="font-black text-[11px] uppercase tracking-wider flex items-center gap-3">
                      {isCompleted ? (
                        <CheckCircle size={18} className="text-emerald-600" />
                      ) : isActive ? (
                        <CheckCircle size={18} className="text-blue-600" />
                      ) : (
                        <div className="w-[18px]" />
                      )}
                      {stage.replace(/_/g, " ")}
                    </span>
                    {!isActive && !isCompleted && (
                      <ArrowRight
                        size={18}
                        className="opacity-0 group-hover:opacity-100 transition-all"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Document Requests */}
          <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm p-7">
            <h3 className="font-black text-slate-900 uppercase tracking-widest text-[10px] mb-6 flex items-center gap-2">
              <FileText size={16} className="text-blue-600" /> Document Requests
            </h3>
            <form
              onSubmit={handleAddDocumentRequest}
              className="flex flex-col gap-3 mb-6"
            >
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="e.g. Passport Copy, Admission Letter…"
                  value={newRequestTitle}
                  onChange={(e) => setNewRequestTitle(e.target.value)}
                  className="flex-1 bg-slate-50 border-2 border-slate-100 px-4 py-3 rounded-xl font-bold text-sm outline-none focus:border-blue-600 transition-all"
                />
                <button
                  type="submit"
                  disabled={updating || !newRequestTitle.trim()}
                  className="bg-blue-600 text-white px-5 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center gap-2 disabled:opacity-40"
                >
                  <Plus size={14} /> Request
                </button>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest shrink-0">
                  Due Date (optional):
                </label>
                <input
                  type="date"
                  value={newRequestDueDate}
                  onChange={(e) => setNewRequestDueDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl text-xs font-bold outline-none focus:border-blue-400 transition-all"
                />
              </div>
            </form>
            {/* Standard Document Checklist */}
            {checklistForCase.length > 0 && (
              <div className="mb-6">
                <button
                  type="button"
                  onClick={() => setShowChecklist(!showChecklist)}
                  className="flex items-center justify-between w-full text-[9px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 border border-blue-100 px-4 py-3 rounded-xl hover:bg-blue-100 transition-all"
                >
                  <span className="flex items-center gap-2"><FileText size={13} /> Standard {currentCase?.case_type?.replace(/_/g, " ")} Checklist</span>
                  <span>{missingChecklistItems.length > 0 ? `${missingChecklistItems.length} not yet requested` : "All documents added ✓"}</span>
                </button>
                {showChecklist && (
                  <div className="mt-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
                    {missingChecklistItems.length > 0 && (
                      <button
                        type="button"
                        onClick={() => addAllChecklistDocs(checklistForCase)}
                        disabled={updating}
                        className="w-full text-[9px] font-black uppercase tracking-widest bg-blue-600 text-white py-2.5 rounded-xl hover:bg-slate-900 transition-all disabled:opacity-40 mb-3"
                      >
                        + Request All {missingChecklistItems.length} Missing Documents
                      </button>
                    )}
                    {checklistForCase.map((doc: string) => {
                      const alreadyAdded = existingRequestTitles.has(doc);
                      return (
                        <div key={doc} className={`flex items-center justify-between px-4 py-2.5 rounded-xl text-xs ${alreadyAdded ? "bg-emerald-50 border border-emerald-100 text-emerald-700" : "bg-white border border-slate-200 text-slate-700"}` }>
                          <span className="font-bold">{doc}</span>
                          {alreadyAdded ? (
                            <span className="text-[9px] font-black uppercase text-emerald-600">Added ✓</span>
                          ) : (
                            <button type="button" onClick={() => addChecklistDoc(doc)} disabled={updating} className="text-[9px] font-black uppercase text-blue-600 hover:text-blue-800 disabled:opacity-40 border border-blue-200 px-2.5 py-1 rounded-lg">
                              + Add
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            {requests.length === 0 ? (
              <div className="py-8 text-center border-2 border-dashed border-slate-100 rounded-2xl text-slate-300 font-bold text-[10px] uppercase tracking-widest">
                No document requests yet
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((req) => {
                  const isOverdue =
                    req.due_date &&
                    req.status === "PENDING" &&
                    new Date(req.due_date) < new Date();
                  return (
                  <div
                    key={req.id}
                    className={`flex items-center justify-between p-4 rounded-2xl border-2 ${
                      req.status === "FULFILLED"
                        ? "border-emerald-100 bg-emerald-50/50"
                        : isOverdue
                        ? "border-red-200 bg-red-50/50"
                        : "border-amber-100 bg-amber-50/50"
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span
                        className={`text-[9px] font-black px-2 py-1 rounded-lg uppercase border shrink-0 ${
                          req.status === "FULFILLED"
                            ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                            : isOverdue
                            ? "bg-red-100 text-red-700 border-red-200"
                            : "bg-amber-100 text-amber-700 border-amber-200"
                        }`}
                      >
                        {req.status}
                      </span>
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-slate-700 block truncate">
                          {req.title}
                        </span>
                        {req.due_date && (
                          <span
                            className={`text-[9px] font-black ${
                              isOverdue ? "text-red-500" : "text-slate-400"
                            }`}
                          >
                            Due: {req.due_date}
                            {isOverdue && " — OVERDUE"}
                          </span>
                        )}
                      </div>
                    </div>
                    {req.status === "PENDING" && (
                      <button
                        onClick={() =>
                          handleFulfillRequest(req.id, req.title)
                        }
                        disabled={updating}
                        className="text-[9px] font-black uppercase text-emerald-600 hover:text-white hover:bg-emerald-500 border border-emerald-200 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                      >
                        <CheckCircle size={12} /> Fulfilled
                      </button>
                    )}
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Officer Log */}
          <div className="bg-slate-900 rounded-[2rem] p-8 text-white shadow-2xl min-h-[240px]">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black uppercase tracking-widest text-[10px] text-blue-400">
                Officer Log
              </h3>
              {events.length > 0 && (
                <button
                  onClick={handleClearLog}
                  disabled={clearingLog}
                  className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 hover:text-red-400 transition-all disabled:opacity-40"
                >
                  <Trash2 size={12} /> Clear Log
                </button>
              )}
            </div>
            {/* Post Note */}
            <div className="flex gap-2 mb-7">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Post a timestamped note to the log…"
                rows={2}
                className="flex-1 bg-slate-800 border border-slate-700 text-slate-100 p-3 rounded-xl text-xs font-medium placeholder-slate-600 resize-none outline-none focus:border-blue-500 transition-all"
              />
              <button
                onClick={handlePostNote}
                disabled={!noteText.trim() || updating}
                className="bg-blue-600 text-white px-4 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-blue-500 disabled:opacity-40 transition-all shrink-0 self-stretch"
              >
                Post
              </button>
            </div>
            {events.length === 0 ? (
              <p className="text-slate-600 text-xs font-bold uppercase tracking-widest">
                No events recorded yet.
              </p>
            ) : (
              <div className="space-y-6">
                {events.map((event) => (
                  <div key={event.id} className="flex gap-6 items-start">
                    <div
                      className={`mt-1 h-3 w-3 rounded-full border-4 border-slate-900 shrink-0 ${
                        event.event_type === "EMAIL_SENT"
                          ? "bg-emerald-500"
                          : event.event_type === "UPLOAD" ||
                            event.event_type === "DOCUMENT_UPLOADED"
                          ? "bg-purple-500"
                          : event.event_type === "DOC_REQUEST"
                          ? "bg-amber-500"
                          : event.event_type === "NOTE"
                          ? "bg-slate-400"
                          : event.event_type === "STUDENT_MESSAGE"
                          ? "bg-pink-500"
                          : "bg-blue-500"
                      }`}
                    />
                    <div>
                      <p className="text-sm font-bold text-slate-100 leading-tight">
                        {event.description}
                      </p>
                      <p className="text-[9px] text-slate-500 font-black mt-1 uppercase tracking-widest">
                        BY: {event.actor_name || "System"} ·{" "}
                        {new Date(event.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-8">
          {/* Admin Controls */}
          <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm p-7">
            <h3 className="font-black text-slate-900 uppercase tracking-widest text-[10px] mb-6">
              Administrative Hub
            </h3>
            <div className="space-y-6">
              <div className="pt-4 border-t border-slate-100">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 block mb-2 flex items-center gap-1">
                  <Calendar size={12} /> Permit Expiry Date
                </label>
                <input
                  type="date"
                  defaultValue={currentCase?.permit_expiry_date || ""}
                  onChange={(e) =>
                    handleUpdate("permit_expiry_date", e.target.value)
                  }
                  className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-black text-slate-900 text-sm outline-none focus:border-blue-600"
                />
              </div>
            </div>
          </div>

          {/* Document Vault */}
          <div className="bg-white border-4 border-slate-900 rounded-[2rem] shadow-xl p-7">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-black text-slate-900 uppercase tracking-widest text-[10px]">
                Document Vault
              </h3>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-900 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <Upload size={14} />
                )}
                {uploading ? "Uploading…" : "Upload"}
              </button>
            </div>

            {docs.length === 0 ? (
              <div className="py-8 text-center border-2 border-dashed border-slate-100 rounded-2xl text-slate-300 font-bold text-[10px] uppercase tracking-widest">
                No documents yet
              </div>
            ) : (
              <div className="space-y-3">
                {docs.map((doc) => (
                  <div
                    key={doc.id}
                    className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <ShieldAlert
                        size={18}
                        className="text-emerald-500 shrink-0"
                      />
                      <span className="text-[11px] font-bold text-slate-700 truncate">
                        {doc.file_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {doc.file_url && (
                        <a
                          href={doc.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-600 transition-all"
                          title="View"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                      <button
                        onClick={() =>
                          supabase
                            .from("documents")
                            .delete()
                            .eq("id", doc.id)
                            .then(() => fetchData())
                        }
                        className="text-slate-300 hover:text-red-500 transition-all"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
