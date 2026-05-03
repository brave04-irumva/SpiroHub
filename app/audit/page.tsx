"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  ClipboardList,
  Loader2,
  Download,
  Filter,
  Search,
  ShieldAlert,
} from "lucide-react";

function csvEscape(val: string) {
  const s = String(val ?? "").replace(/"/g, '""');
  return `"${s}"`;
}

export default function AuditLogPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [actorFilter, setActorFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: officer } = await supabase
      .from("officers")
      .select("role")
      .eq("email", user.email)
      .single();
    if (officer?.role === "ADMIN") setIsAdmin(true);

    const { data } = await supabase
      .from("case_events")
      .select(
        "*, compliance_cases(id, current_stage, students(full_name, student_id))",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (data) setEvents(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const eventTypes = [
    "ALL",
    ...Array.from(new Set(events.map((e) => e.event_type))).sort(),
  ];
  const actors = Array.from(
    new Set(events.map((e) => e.actor_name).filter(Boolean)),
  ).sort();

  const filtered = events.filter((e) => {
    if (typeFilter !== "ALL" && e.event_type !== typeFilter) return false;
    if (actorFilter && e.actor_name !== actorFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const student = e.compliance_cases?.students;
      return (
        e.description?.toLowerCase().includes(q) ||
        student?.full_name?.toLowerCase().includes(q) ||
        student?.student_id?.toLowerCase().includes(q) ||
        e.actor_name?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  function exportCSV() {
    const rows = [
      [
        "Timestamp",
        "Event Type",
        "Description",
        "Actor",
        "Student Name",
        "Student ID",
        "Stage",
      ],
      ...filtered.map((e) => [
        new Date(e.created_at).toISOString(),
        e.event_type,
        e.description,
        e.actor_name ?? "",
        e.compliance_cases?.students?.full_name ?? "",
        e.compliance_cases?.students?.student_id ?? "",
        e.compliance_cases?.current_stage ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.map(csvEscape).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `spirohub-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading)
    return (
      <div className="h-96 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );

  if (!isAdmin)
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-4 text-slate-400">
        <ShieldAlert size={48} className="opacity-30" />
        <p className="font-black text-sm uppercase tracking-widest">
          Admin access required.
        </p>
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
        <div>
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-2">
            Admin Only
          </p>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">
            Audit Log
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-2">
            {filtered.length} of {events.length} events shown.
          </p>
        </div>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-blue-600 transition-all"
        >
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-[2rem] p-6 flex flex-wrap gap-4 items-end shadow-sm">
        <div className="flex-1 min-w-48">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
            Search
          </label>
          <div className="relative">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Name, description, student ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none focus:border-blue-400"
            />
          </div>
        </div>
        <div className="min-w-40">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
            Event Type
          </label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-400"
          >
            {eventTypes.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-40">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 block">
            Actor
          </label>
          <select
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-400"
          >
            <option value="">All Actors</option>
            {actors.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        {(search || typeFilter !== "ALL" || actorFilter) && (
          <button
            onClick={() => {
              setSearch("");
              setTypeFilter("ALL");
              setActorFilter("");
            }}
            className="text-[9px] font-black uppercase tracking-widest text-blue-600 hover:underline mt-4"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Timestamp
                </th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Event
                </th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Description
                </th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Actor
                </th>
                <th className="px-6 py-4 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Student
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-16 text-center text-slate-300 font-bold text-sm uppercase tracking-widest"
                  >
                    No events match your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((event) => {
                  const student = event.compliance_cases?.students;
                  return (
                    <tr
                      key={event.id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-[10px] font-black text-slate-700 tabular-nums">
                          {new Date(event.created_at).toLocaleDateString(
                            "en-KE",
                            {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            },
                          )}
                        </p>
                        <p className="text-[9px] text-slate-400 font-bold tabular-nums">
                          {new Date(event.created_at).toLocaleTimeString(
                            "en-KE",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg">
                          {event.event_type?.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        <p className="text-sm text-slate-700 font-medium truncate">
                          {event.description}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-[10px] font-bold text-slate-600">
                          {event.actor_name ?? "—"}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        {student ? (
                          <>
                            <p className="text-[10px] font-bold text-slate-700">
                              {student.full_name}
                            </p>
                            <p className="text-[9px] text-slate-400 font-bold">
                              {student.student_id}
                            </p>
                          </>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
