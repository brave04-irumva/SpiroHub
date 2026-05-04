"use client";

import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { getRiskState, getStatusStyles } from "@/utils/compliance";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  AlertCircle,
  FileText,
  MessageSquare,
  LogOut,
  Loader2,
  Upload,
  CheckCircle2,
  Clock,
  Info,
  Paperclip,
  XCircle,
  Calendar,
  Bell,
  Send,
  X,
  Megaphone,
  UserPen,
} from "lucide-react";

const STAGES_ORDER = [
  "DOCUMENTS_PENDING",
  "DOCUMENT_SUBMITTED",
  "PAYMENT_MADE",
  "SUBMITTED_TO_IMMIGRATION",
  "AWAITING_COLLECTION",
  "PASSPORT_COLLECTED",
];

const STAGE_INFO: Record<string, { label: string; hint: string }> = {
  DOCUMENTS_PENDING: {
    label: "Documents Pending",
    hint: "Your officer is waiting for documents from you. Check the requests below.",
  },
  DOCUMENT_SUBMITTED: {
    label: "Document Submitted",
    hint: "Your documents have been received and are under review.",
  },
  PAYMENT_MADE: {
    label: "Payment Made",
    hint: "Payment has been confirmed and your application is moving forward.",
  },
  SUBMITTED_TO_IMMIGRATION: {
    label: "Submitted to Immigration",
    hint: "Your case has been forwarded to the immigration office.",
  },
  AWAITING_COLLECTION: {
    label: "Awaiting Collection",
    hint: "Your document is being finalized and is almost ready for pickup.",
  },
  PASSPORT_COLLECTED: {
    label: "Passport Collected",
    hint: "Process completed successfully. Keep your records updated.",
  },
};

function splitName(fullName: string) {
  const parts = String(fullName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length <= 1) {
    return { first_name: parts[0] ?? "", surname: "" };
  }
  return {
    first_name: parts[0],
    surname: parts.slice(1).join(" "),
  };
}

export default function StudentPortal() {
  const router = useRouter();
  const updatesSectionRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<any>(null);
  const [complianceCase, setComplianceCase] = useState<any>(null);
  const [docRequests, setDocRequests] = useState<any[]>([]);
  const [caseEvents, setCaseEvents] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<
    Set<string>
  >(new Set());
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [messageSending, setMessageSending] = useState(false);
  const [uploadState, setUploadState] = useState<
    Record<
      string,
      { file: File | null; uploading: boolean; error: string; done: boolean }
    >
  >({});
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    first_name: "",
    surname: "",
    phone: "",
    course: "",
    nationality: "",
  });

  useEffect(() => {
    async function init() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }

      const { data: studentData } = await supabase
        .from("students")
        .select("*")
        .eq("email", session.user.email)
        .single();
      if (!studentData) {
        router.replace("/");
        return;
      }
      setStudent(studentData);
      const names = splitName(studentData.full_name ?? "");
      setProfileForm({
        first_name: names.first_name,
        surname: names.surname,
        phone: studentData.phone ?? "",
        course: studentData.course ?? "",
        nationality: studentData.nationality ?? "",
      });

      const { data: caseData } = await supabase
        .from("compliance_cases")
        .select("*")
        .eq("student_id", studentData.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (caseData) {
        setComplianceCase(caseData);
        const [reqRes, eventsRes, docsRes] = await Promise.all([
          supabase
            .from("document_requests")
            .select("*")
            .eq("case_id", caseData.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("case_events")
            .select("*")
            .eq("case_id", caseData.id)
            .order("created_at", { ascending: false }),
          supabase
            .from("documents")
            .select("*")
            .eq("case_id", caseData.id)
            .order("created_at", { ascending: false }),
        ]);
        if (reqRes.data) setDocRequests(reqRes.data);
        if (eventsRes.data) setCaseEvents(eventsRes.data);
        if (docsRes.data) setDocuments(docsRes.data);
        // Notification bell
        const lastVisitKey = `spirohub_last_visit_${caseData.id}`;
        const lastVisit = localStorage.getItem(lastVisitKey);
        if (lastVisit && eventsRes.data) {
          const unread = eventsRes.data.filter(
            (e: any) => new Date(e.created_at) > new Date(lastVisit),
          ).length;
          setUnreadCount(unread);
        }
        localStorage.setItem(lastVisitKey, new Date().toISOString());
      }
      // Announcements (graceful if table missing)
      try {
        const { data: announcementData } = await supabase
          .from("announcements")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false });
        if (announcementData) setAnnouncements(announcementData);
      } catch {
        /* table not yet created */
      }

      setLoading(false);
    }
    init();
  }, [router]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function handleBellClick() {
    setUnreadCount(0);
    setShowNotifications((prev) => !prev);
  }

  function jumpToUpdates() {
    updatesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    setShowNotifications(false);
  }

  function setUploadFile(reqId: string, file: File | null) {
    setUploadState((prev) => ({
      ...prev,
      [reqId]: { file, uploading: false, error: "", done: false },
    }));
  }

  async function handleUpload(req: any) {
    const state = uploadState[req.id];
    if (!state?.file || !complianceCase) return;
    const file = state.file;
    setUploadState((prev) => ({
      ...prev,
      [req.id]: { ...prev[req.id], uploading: true, error: "" },
    }));
    const ext = file.name.split(".").pop();
    const path = `${complianceCase.id}/${Date.now()}_${req.id}.${ext}`;
    const { error: storageError } = await supabase.storage
      .from("compliance_vault")
      .upload(path, file);
    if (storageError) {
      setUploadState((prev) => ({
        ...prev,
        [req.id]: {
          ...prev[req.id],
          uploading: false,
          error: storageError.message,
        },
      }));
      return;
    }
    const { data: urlData } = supabase.storage
      .from("compliance_vault")
      .getPublicUrl(path);
    await supabase
      .from("documents")
      .insert([
        {
          case_id: complianceCase.id,
          file_name: file.name,
          file_url: urlData.publicUrl,
          uploaded_by: student?.full_name ?? "Student",
        },
      ]);
    await supabase
      .from("document_requests")
      .update({ status: "FULFILLED" })
      .eq("id", req.id);
    await supabase
      .from("case_events")
      .insert([
        {
          case_id: complianceCase.id,
          event_type: "DOCUMENT_UPLOADED",
          description: `Student uploaded "${file.name}" in response to request: ${req.title}`,
          actor_name: student?.full_name ?? "Student",
        },
      ]);
    const [reqRes, docsRes] = await Promise.all([
      supabase
        .from("document_requests")
        .select("*")
        .eq("case_id", complianceCase.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("documents")
        .select("*")
        .eq("case_id", complianceCase.id)
        .order("created_at", { ascending: false }),
    ]);
    if (reqRes.data) setDocRequests(reqRes.data);
    if (docsRes.data) setDocuments(docsRes.data);
    // Auto-advance
    if (reqRes.data) {
      const stillPending = reqRes.data.filter(
        (r: any) => r.status === "PENDING",
      ).length;
      if (
        stillPending === 0 &&
        complianceCase.current_stage === "DOCUMENTS_PENDING"
      ) {
        await supabase
          .from("compliance_cases")
          .update({ current_stage: "DOCUMENT_SUBMITTED" })
          .eq("id", complianceCase.id);
        await supabase
          .from("case_events")
          .insert([
            {
              case_id: complianceCase.id,
              event_type: "STAGE_CHANGE",
              description:
                "Stage automatically advanced to DOCUMENT SUBMITTED — all document requests fulfilled.",
              actor_name: "System",
            },
          ]);
        setComplianceCase((prev: any) => ({
          ...prev,
          current_stage: "DOCUMENT_SUBMITTED",
        }));
      }
    }
    setUploadState((prev) => ({
      ...prev,
      [req.id]: { file: null, uploading: false, error: "", done: true },
    }));
  }

  async function handleSendMessage() {
    if (!messageText.trim() || !complianceCase) return;
    setMessageSending(true);
    await supabase
      .from("case_events")
      .insert([
        {
          case_id: complianceCase.id,
          event_type: "STUDENT_MESSAGE",
          description: messageText.trim(),
          actor_name: student?.full_name ?? "Student",
        },
      ]);
    const { data } = await supabase
      .from("case_events")
      .select("*")
      .eq("case_id", complianceCase.id)
      .order("created_at", { ascending: false });
    if (data) setCaseEvents(data);
    setMessageText("");
    setMessageSending(false);
  }

  async function handleSaveProfile() {
    if (!student) return;
    setSavingProfile(true);
    const fullName = [profileForm.first_name, profileForm.surname]
      .filter(Boolean)
      .join(" ")
      .trim();
    await supabase
      .from("students")
      .update({
        full_name: fullName,
        phone: profileForm.phone || null,
        course: profileForm.course || null,
        nationality: profileForm.nationality,
      })
      .eq("id", student.id);
    if (complianceCase) {
      await supabase
        .from("case_events")
        .insert([
          {
            case_id: complianceCase.id,
            event_type: "UPDATE",
            description: "Student updated their profile details.",
            actor_name: fullName || "Student",
          },
        ]);
    }
    const { data: updated } = await supabase
      .from("students")
      .select("*")
      .eq("id", student.id)
      .single();
    if (updated) {
      setStudent(updated);
      const names = splitName(updated.full_name ?? "");
      setProfileForm({
        first_name: names.first_name,
        surname: names.surname,
        phone: updated.phone ?? "",
        course: updated.course ?? "",
        nationality: updated.nationality ?? "",
      });
    }
    setShowEditProfile(false);
    setSavingProfile(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  const risk = complianceCase
    ? getRiskState(complianceCase.permit_expiry_date)
    : "UNKNOWN";
  const riskStyles = getStatusStyles(risk);
  const stageInfo = complianceCase
    ? (STAGE_INFO[complianceCase.current_stage] ?? null)
    : null;
  const pendingRequests = docRequests.filter((r) => r.status === "PENDING");
  const currentStepIndex = complianceCase
    ? STAGES_ORDER.indexOf(complianceCase.current_stage)
    : -1;
  const permitDaysRemaining = complianceCase?.permit_expiry_date
    ? Math.ceil(
        (new Date(complianceCase.permit_expiry_date).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      )
    : null;
  const riskBg =
    risk === "EXPIRED"
      ? "bg-red-50 border-red-200"
      : risk === "EXPIRING_SOON"
        ? "bg-amber-50 border-amber-200"
        : risk === "COMPLIANT"
          ? "bg-emerald-50 border-emerald-200"
          : "bg-slate-50 border-slate-200";
  const visibleAnnouncements = announcements.filter(
    (a) => !dismissedAnnouncements.has(a.id),
  );
  const recentEvents = caseEvents.slice(0, 5);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-black text-slate-900 text-sm uppercase tracking-widest">
              SpiroHub
            </span>
            <span className="text-slate-300 text-xs font-medium hidden sm:inline">
              / Student Portal
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleBellClick}
              title={
                unreadCount > 0
                  ? `${unreadCount} new updates`
                  : "No new updates"
              }
              className="relative h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:border-blue-300 transition-all"
            >
              <Bell size={15} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 bg-blue-600 text-white text-[8px] font-black rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            {showNotifications && (
              <div className="absolute right-6 top-16 w-[320px] max-w-[calc(100vw-3rem)] bg-white border border-slate-200 rounded-2xl shadow-xl p-3 z-20">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">
                    Recent Updates
                  </p>
                  <button
                    onClick={() => setShowNotifications(false)}
                    className="text-slate-400 hover:text-slate-700"
                    aria-label="Close notifications"
                  >
                    <X size={14} />
                  </button>
                </div>
                {recentEvents.length === 0 ? (
                  <p className="text-xs text-slate-500 font-medium py-2">
                    No updates yet.
                  </p>
                ) : (
                  <ul className="space-y-2 max-h-64 overflow-auto pr-1">
                    {recentEvents.map((event) => (
                      <li key={event.id} className="bg-slate-50 border border-slate-100 rounded-xl p-2.5">
                        <p className="text-xs font-black text-slate-800 line-clamp-2">
                          {event.description}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-500 font-bold uppercase tracking-wide">
                          {(event.event_type ?? "update").replace(/_/g, " ")} · {new Date(event.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  onClick={jumpToUpdates}
                  className="mt-3 w-full bg-blue-600 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all"
                >
                  View All Updates
                </button>
              </div>
            )}
            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 text-slate-400 hover:text-red-500 text-xs font-black uppercase tracking-widest transition-all"
            >
              <LogOut size={14} /> Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        <div>
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-2">
            Student Portal
          </p>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">
            Welcome, {student?.full_name?.split(" ")[0]}
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Overview · {student?.student_id}
          </p>
        </div>

        {/* Announcements */}
        {visibleAnnouncements.map((a) => (
          <div
            key={a.id}
            className="bg-blue-50 border border-blue-200 rounded-2xl px-5 py-4 flex items-start justify-between gap-4"
          >
            <div className="flex items-start gap-3">
              <Megaphone size={16} className="text-blue-600 shrink-0 mt-0.5" />
              <p className="text-blue-800 text-sm font-medium leading-relaxed">
                {a.message}
              </p>
            </div>
            <button
              onClick={() =>
                setDismissedAnnouncements((prev) => new Set([...prev, a.id]))
              }
              className="text-blue-400 hover:text-blue-700 shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        ))}

        {pendingRequests.length > 0 && (
          <div className="bg-amber-50 border-2 border-amber-200 rounded-[2rem] p-6 flex items-start gap-4">
            <AlertCircle size={22} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-amber-800 text-sm uppercase tracking-wider">
                Action Required
              </p>
              <p className="text-amber-700 text-sm font-medium mt-1">
                Your officer has requested{" "}
                <span className="font-black">{pendingRequests.length}</span>{" "}
                document{pendingRequests.length > 1 ? "s" : ""} from you. See
                the Document Requests section below.
              </p>
            </div>
          </div>
        )}

        {/* Status card */}
        {complianceCase ? (
          <div className={`rounded-[2rem] border-2 p-7 ${riskBg}`}>
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Compliance Status
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  <span
                    className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase border-2 ${riskStyles}`}
                  >
                    {risk.replace(/_/g, " ")}
                  </span>
                  <span className="text-slate-600 text-xs font-bold">
                    {complianceCase.permit_expiry_date
                      ? `Permit expires: ${complianceCase.permit_expiry_date}`
                      : "No expiry date set yet"}
                  </span>
                  {permitDaysRemaining !== null && (
                    <span
                      className={`text-[10px] font-black px-3 py-1 rounded-full border ${permitDaysRemaining < 0 ? "bg-red-100 text-red-700 border-red-200" : permitDaysRemaining <= 30 ? "bg-amber-100 text-amber-700 border-amber-200" : "bg-emerald-100 text-emerald-700 border-emerald-200"}`}
                    >
                      {permitDaysRemaining < 0
                        ? `${Math.abs(permitDaysRemaining)} days overdue`
                        : `${permitDaysRemaining} days remaining`}
                    </span>
                  )}
                </div>
                {stageInfo && (
                  <div className="flex items-start gap-2 mt-1">
                    <Info
                      size={13}
                      className="text-slate-400 mt-0.5 shrink-0"
                    />
                    <p className="text-slate-600 text-sm font-medium">
                      {stageInfo.hint}
                    </p>
                  </div>
                )}
              </div>
              <div className="shrink-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
                  Stage
                </p>
                <span className="text-xs font-black text-blue-700 bg-white border-2 border-blue-100 px-4 py-2 rounded-xl uppercase block text-center">
                  {stageInfo?.label ??
                    complianceCase.current_stage?.replace(/_/g, " ")}
                </span>
              </div>
            </div>
            {/* Progress bar */}
            {currentStepIndex >= 0 && (
              <div className="mt-7 pt-6 border-t border-white/50">
                <div className="flex items-center">
                  {STAGES_ORDER.map((stage, i) => {
                    const isDone = i < currentStepIndex;
                    const isCurrent = i === currentStepIndex;
                    return (
                      <React.Fragment key={stage}>
                        <div
                          title={stage.replace(/_/g, " ")}
                          className={`h-7 w-7 rounded-full flex items-center justify-center text-[9px] font-black border-2 transition-all ${isDone ? "bg-emerald-500 border-emerald-500 text-white" : isCurrent ? "bg-blue-600 border-blue-600 text-white shadow-lg" : "bg-white border-slate-200 text-slate-300"}`}
                        >
                          {isDone ? "✓" : i + 1}
                        </div>
                        {i < STAGES_ORDER.length - 1 && (
                          <div
                            className={`flex-1 h-0.5 ${i < currentStepIndex ? "bg-emerald-500" : "bg-slate-200"}`}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
                <div className="flex justify-between mt-1.5">
                  {STAGES_ORDER.map((stage, i) => (
                    <div
                      key={stage}
                      style={{ width: `${100 / STAGES_ORDER.length}%` }}
                      className={`text-center text-[7px] font-black uppercase leading-tight px-0.5 ${i === currentStepIndex ? "text-blue-600" : "text-slate-400"}`}
                    >
                      {stage.split("_")[0]}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-[2rem] p-10 border-2 border-dashed border-slate-200 text-center text-slate-500 font-bold text-sm">
            No compliance case on record. Contact the International Office.
          </div>
        )}

        {/* Submit Requested Documents */}
        {pendingRequests.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60">
              <h2 className="font-black text-slate-900 text-[10px] uppercase tracking-widest flex items-center gap-2">
                <Paperclip size={14} className="text-blue-600" /> Submit
                Requested Documents
              </h2>
              <p className="text-slate-400 text-xs font-medium mt-1">
                Upload a file for each pending request below.
              </p>
            </div>
            <ul className="divide-y divide-slate-100">
              {pendingRequests.map((req) => {
                const us = uploadState[req.id];
                return (
                  <li key={req.id} className="px-6 py-5">
                    <div className="flex items-start gap-3 mb-3">
                      <FileText
                        size={15}
                        className="text-amber-500 shrink-0 mt-0.5"
                      />
                      <div>
                        <p className="font-black text-slate-900 text-sm">
                          {req.title}
                        </p>
                        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">
                          Requested{" "}
                          {new Date(req.created_at).toLocaleDateString(
                            "en-KE",
                            { day: "numeric", month: "short", year: "numeric" },
                          )}
                          {req.due_date && ` · Due ${req.due_date}`}
                        </p>
                      </div>
                    </div>
                    {us?.done ? (
                      <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-4 py-3 text-xs font-black">
                        <CheckCircle2 size={15} /> Submitted successfully
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="relative">
                          <input
                            type="file"
                            id={`file-${req.id}`}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            onChange={(e) =>
                              setUploadFile(req.id, e.target.files?.[0] ?? null)
                            }
                            disabled={us?.uploading}
                          />
                          <div
                            className={`flex items-center gap-3 border-2 rounded-xl px-4 py-3 transition-all ${us?.file ? "border-blue-300 bg-blue-50" : "border-dashed border-slate-200 bg-slate-50"}`}
                          >
                            <Upload
                              size={14}
                              className={
                                us?.file ? "text-blue-600" : "text-slate-400"
                              }
                            />
                            <span
                              className={`text-xs font-bold truncate ${us?.file ? "text-blue-700" : "text-slate-400"}`}
                            >
                              {us?.file
                                ? us.file.name
                                : "Choose file to upload"}
                            </span>
                            {us?.file && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setUploadFile(req.id, null);
                                }}
                                className="ml-auto text-slate-400 hover:text-red-500 transition-all shrink-0"
                              >
                                <XCircle size={15} />
                              </button>
                            )}
                          </div>
                        </div>
                        {us?.error && (
                          <p className="text-red-600 text-xs font-bold">
                            {us.error}
                          </p>
                        )}
                        <button
                          onClick={() => handleUpload(req)}
                          disabled={!us?.file || us?.uploading}
                          className="w-full bg-blue-600 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                        >
                          {us?.uploading ? (
                            <>
                              <Loader2 className="animate-spin" size={14} />{" "}
                              Uploading&hellip;
                            </>
                          ) : (
                            <>
                              <Upload size={14} /> Submit Document
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <h2 className="font-black text-slate-900 text-[10px] uppercase tracking-widest flex items-center gap-2">
                <FileText size={14} className="text-blue-600" /> Document
                Requests
              </h2>
              <span className="text-[9px] font-black text-slate-400 uppercase">
                {docRequests.length} total
              </span>
            </div>
            {docRequests.length === 0 ? (
              <div className="p-10 text-center">
                <CheckCircle2
                  size={28}
                  className="text-slate-200 mx-auto mb-3"
                />
                <p className="text-slate-400 text-xs font-bold">
                  No requests yet.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-50">
                {docRequests.map((req) => (
                  <li
                    key={req.id}
                    className="px-6 py-4 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText
                        size={14}
                        className={
                          req.status === "FULFILLED"
                            ? "text-emerald-500 shrink-0"
                            : "text-amber-500 shrink-0"
                        }
                      />
                      <div className="min-w-0">
                        <span className="font-bold text-slate-800 text-sm block truncate">
                          {req.title}
                        </span>
                        {req.due_date && (
                          <span className="text-[9px] text-slate-400 font-bold">
                            Due: {req.due_date}
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`text-[9px] font-black uppercase px-3 py-1 rounded-full border shrink-0 ${req.status === "FULFILLED" ? "text-emerald-700 bg-emerald-50 border-emerald-100" : "text-amber-700 bg-amber-50 border-amber-100"}`}
                    >
                      {req.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
              <h2 className="font-black text-slate-900 text-[10px] uppercase tracking-widest flex items-center gap-2">
                <Upload size={14} className="text-blue-600" /> Submitted
                Documents
              </h2>
              <span className="text-[9px] font-black text-slate-400 uppercase">
                {documents.length} files
              </span>
            </div>
            {documents.length === 0 ? (
              <div className="p-10 text-center">
                <Upload size={28} className="text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 text-xs font-bold">
                  No documents on file yet.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-50">
                {documents.map((doc) => (
                  <li
                    key={doc.id}
                    className="px-6 py-4 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-sm truncate">
                        {doc.file_name}
                      </p>
                      <p className="text-slate-400 text-[10px] font-bold">
                        {new Date(doc.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-[9px] font-black uppercase tracking-widest border border-blue-100 bg-blue-50 px-3 py-1.5 rounded-lg transition-all shrink-0"
                    >
                      View
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div
          ref={updatesSectionRef}
          className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60">
            <h2 className="font-black text-slate-900 text-[10px] uppercase tracking-widest flex items-center gap-2">
              <MessageSquare size={14} className="text-blue-600" /> Updates from
              Compliance Office
            </h2>
          </div>
          {caseEvents.length === 0 ? (
            <div className="p-12 text-center">
              <Clock size={28} className="text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-xs font-bold">
                No updates yet. Your officer will post progress here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-50">
              {caseEvents.map((event) => (
                <li key={event.id} className="px-6 py-5 flex gap-4">
                  <div className="h-9 w-9 rounded-xl bg-slate-900 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                    {event.actor_name
                      ?.split(" ")
                      .map((n: string) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase() ?? "CO"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-black text-slate-900 text-xs">
                        {event.actor_name ?? "Compliance Office"}
                      </span>
                      <span className="text-[9px] text-slate-400 font-bold shrink-0">
                        {new Date(event.created_at).toLocaleDateString(
                          "en-KE",
                          { day: "numeric", month: "short", year: "numeric" },
                        )}
                      </span>
                    </div>
                    <p className="text-slate-700 text-sm font-medium leading-relaxed">
                      {event.description}
                    </p>
                    <span className="mt-1.5 inline-block text-[9px] font-black uppercase text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-lg">
                      {event.event_type?.replace(/_/g, " ")}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Message officer */}
        {complianceCase && (
          <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60">
              <h2 className="font-black text-slate-900 text-[10px] uppercase tracking-widest flex items-center gap-2">
                <Send size={14} className="text-blue-600" /> Message Your
                Officer
              </h2>
              <p className="text-slate-400 text-xs font-medium mt-1">
                The message will appear in your compliance
                officer&apos;s event log.
              </p>
            </div>
            <div className="px-6 py-6 flex gap-3">
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type your message here&hellip;"
                rows={3}
                className="flex-1 bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl text-sm font-medium text-slate-800 outline-none focus:border-blue-600 transition-all resize-none"
              />
              <button
                onClick={handleSendMessage}
                disabled={!messageText.trim() || messageSending}
                className="bg-blue-600 text-white px-5 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-900 disabled:opacity-40 transition-all flex flex-col items-center justify-center gap-2 shrink-0"
              >
                {messageSending ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <>
                    <Send size={16} />
                    <span>Send</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {complianceCase?.notes && (
          <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm p-7">
            <h2 className="font-black text-slate-900 text-[10px] uppercase tracking-widest flex items-center gap-2 mb-4">
              <Info size={14} className="text-blue-600" /> Officer Notes
            </h2>
            <p className="text-slate-700 text-sm font-medium leading-relaxed whitespace-pre-wrap">
              {complianceCase.notes}
            </p>
          </div>
        )}

        {/* Edit My Profile */}
        <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden">
          <button
            onClick={() => setShowEditProfile(!showEditProfile)}
            className="w-full px-6 py-4 flex items-center justify-between text-[10px] font-black text-slate-900 uppercase tracking-widest hover:bg-slate-50 transition-all"
          >
            <span className="flex items-center gap-2">
              <UserPen size={14} className="text-blue-600" /> Edit My Profile
            </span>
            <span className="text-slate-400 text-[9px]">
              {showEditProfile ? "Collapse ▲" : "Expand ▼"}
            </span>
          </button>
          {showEditProfile && (
            <div className="px-6 pb-6 border-t border-slate-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={profileForm.first_name}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        first_name: e.target.value,
                      })
                    }
                    className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl font-bold text-sm outline-none focus:border-blue-600 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Surname
                  </label>
                  <input
                    type="text"
                    value={profileForm.surname}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        surname: e.target.value,
                      })
                    }
                    className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl font-bold text-sm outline-none focus:border-blue-600 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Nationality
                  </label>
                  <input
                    type="text"
                    value={profileForm.nationality}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        nationality: e.target.value,
                      })
                    }
                    className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl font-bold text-sm outline-none focus:border-blue-600 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, phone: e.target.value })
                    }
                    placeholder="+254 7XX XXX XXX"
                    className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl font-bold text-sm outline-none focus:border-blue-600 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Course / Programme
                  </label>
                  <input
                    type="text"
                    value={profileForm.course}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, course: e.target.value })
                    }
                    placeholder="e.g. BSc Computer Science"
                    className="w-full bg-slate-50 border-2 border-slate-100 p-3 rounded-xl font-bold text-sm outline-none focus:border-blue-600 transition-all"
                  />
                </div>
              </div>
              <button
                onClick={handleSaveProfile}
                disabled={savingProfile}
                className="mt-5 w-full bg-blue-600 text-white py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-900 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {savingProfile ? (
                  <Loader2 className="animate-spin" size={14} />
                ) : (
                  <>
                    <UserPen size={14} /> Save Profile
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        <div className="bg-slate-900 rounded-[2rem] p-7 text-white flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-5">
            <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center font-black text-xl shrink-0">
              {student?.full_name
                ?.split(" ")
                .map((n: string) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div>
              <p className="font-black text-white text-lg tracking-tight">
                {student?.full_name}
              </p>
              <p className="text-slate-400 text-xs font-bold">
                {student?.email}
              </p>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-0.5">
                {student?.nationality} · {student?.student_id}
              </p>
            </div>
          </div>
          <div className="text-center sm:text-right shrink-0">
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
              Case Type
            </p>
            <p className="text-white font-black text-sm mt-0.5">
              {complianceCase?.case_type?.replace(/_/g, " ") ?? "—"}
            </p>
          </div>
        </div>

        <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-widest pb-4">
          Daystar University · Placement Office · SpiroHub
        </p>
      </main>
    </div>
  );
}
