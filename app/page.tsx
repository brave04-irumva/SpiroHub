"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { getRiskState, getStatusStyles } from "@/utils/compliance";
import {
  AlertCircle,
  Clock,
  ShieldCheck,
  Activity,
  Loader2,
  ArrowUpRight,
  UserPlus,
  Download,
  Search,
  Square,
  CheckSquare,
  ChevronRight,
  AlertOctagon,
} from "lucide-react";
import Link from "next/link";

const WORKFLOW_STAGES = [
  "DOCUMENTS_PENDING",
  "DOCUMENT_SUBMITTED",
  "PAYMENT_MADE",
  "SUBMITTED_TO_IMMIGRATION",
  "AWAITING_COLLECTION",
  "PASSPORT_COLLECTED",
];

export default function Dashboard() {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dashSearch, setDashSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    const { data } = await supabase
      .from("compliance_cases")
      .select(`*, students (*)`);
    if (data) setCases(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleBulkAdvance() {
    if (selectedIds.size === 0) return;
    if (
      !confirm(
        `Advance ${selectedIds.size} case${
          selectedIds.size > 1 ? "s" : ""
        } to their next stage?`,
      )
    )
      return;
    await Promise.all(
      [...selectedIds].map((id) => {
        const c = cases.find((cc) => cc.id === id);
        if (!c) return Promise.resolve();
        const idx = WORKFLOW_STAGES.indexOf(c.current_stage);
        if (idx < 0 || idx >= WORKFLOW_STAGES.length - 1)
          return Promise.resolve();
        return supabase
          .from("compliance_cases")
          .update({ current_stage: WORKFLOW_STAGES[idx + 1] })
          .eq("id", id);
      }),
    );
    setSelectedIds(new Set());
    fetchData();
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  if (loading)
    return (
      <div className="h-96 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );

  const stats = calculateStats(cases);

  const overdueCases = cases.filter((c) => {
    const terminal = ["PASSPORT_COLLECTED"];
    if (terminal.includes(c.current_stage)) return false;
    return (
      new Date().getTime() - new Date(c.created_at).getTime() >
      14 * 24 * 60 * 60 * 1000
    );
  }).length;

  const q = dashSearch.trim().toLowerCase();
  const filteredCases = q
    ? cases.filter(
        (c) =>
          c.students?.full_name?.toLowerCase().includes(q) ||
          c.students?.student_id?.toLowerCase().includes(q) ||
          c.students?.nationality?.toLowerCase().includes(q) ||
          c.current_stage?.toLowerCase().includes(q),
      )
    : cases;

  function handleExportCSV() {
    const rows = [
      [
        "Student Name",
        "Student ID",
        "Email",
        "Nationality",
        "Stage",
        "Expiry Date",
        "Risk Status",
        "Case Type",
      ],
    ];

    cases.forEach((item) => {
      const risk = getRiskState(item.permit_expiry_date);
      rows.push([
        item.students?.full_name ?? "",
        item.students?.student_id ?? "",
        item.students?.email ?? "",
        item.students?.nationality ?? "",
        item.current_stage?.replace(/_/g, " ") ?? "",
        item.permit_expiry_date ?? "",
        risk.replace(/_/g, " "),
        item.case_type?.replace(/_/g, " ") ?? "",
      ]);
    });

    const csv = rows
      .map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `compliance-queue-${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.click();
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700 pb-8">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-5">
        <div>
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-2">
            Overview
          </p>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">
            Dashboard
          </h1>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          {cases.length > 0 && (
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center justify-center bg-slate-700 text-white px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-slate-500/10 hover:bg-slate-900 transition-all gap-2"
            >
              <Download size={14} /> Export CSV
            </button>
          )}
          <Link
            href="/directory?new=1"
            className="inline-flex items-center justify-center bg-blue-600 text-white px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-500/10 hover:bg-slate-900 transition-all"
          >
            + Add Student
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <StatCard
          title="Total Cases"
          value={cases.length}
          icon={<Activity size={20} />}
          color="blue"
        />
        <StatCard
          title="Expired"
          value={stats.expired}
          icon={<AlertCircle size={20} />}
          color="red"
        />
        <StatCard
          title="Expiring Soon"
          value={stats.expiringSoon}
          icon={<Clock size={20} />}
          color="amber"
        />
        <StatCard
          title="Compliant"
          value={stats.compliant}
          icon={<ShieldCheck size={20} />}
          color="emerald"
        />
        <StatCard
          title="Overdue"
          value={overdueCases}
          icon={<AlertOctagon size={20} />}
          color="orange"
        />
      </div>

      {/* Risk Distribution Chart */}
      {cases.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm p-7">
          <div className="flex items-center gap-2 mb-6">
            <ShieldCheck size={16} className="text-blue-600" />
            <h2 className="font-black text-slate-900 text-[10px] uppercase tracking-widest">
              Risk Distribution
            </h2>
          </div>
          <RiskDistributionChart cases={cases} />
        </div>
      )}

      {/* Compliance Queue */}
      <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60 flex flex-wrap justify-between items-center gap-3">
          <h2 className="font-black text-slate-900 text-[10px] uppercase tracking-widest">
            Compliance Queue — {filteredCases.length} records
          </h2>
          <div className="relative">
            <Search
              size={13}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search students…"
              value={dashSearch}
              onChange={(e) => setDashSearch(e.target.value)}
              className="pl-8 pr-4 py-2 text-xs font-bold bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-400 transition-all w-52"
            />
          </div>
        </div>
        {selectedIds.size > 0 && (
          <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
            <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest">
              {selectedIds.size} case{selectedIds.size > 1 ? "s" : ""} selected
            </span>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-[9px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-700"
              >
                Clear
              </button>
              <button
                onClick={handleBulkAdvance}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-slate-900 transition-all"
              >
                <ChevronRight size={13} /> Advance Stage
              </button>
            </div>
          </div>
        )}
        {cases.length === 0 ? (
          <div className="p-14 text-center border-2 border-dashed border-slate-100 rounded-[2rem] m-6">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-5">
              <UserPlus size={30} />
            </div>
            <h3 className="text-xl font-black text-slate-900 tracking-tight uppercase">
              No Compliance Cases Yet
            </h3>
            <p className="text-slate-500 font-medium mt-2 mb-5">
              Register your first student to activate the compliance pipeline.
            </p>
            <Link
              href="/directory?new=1"
              className="inline-flex items-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-all"
            >
              <UserPlus size={14} /> Register Student
            </Link>
          </div>
        ) : (
          <QueueTable
            cases={filteredCases}
            selectedIds={selectedIds}
            onToggle={toggleSelect}
            onToggleAll={() => {
              if (selectedIds.size === filteredCases.length) {
                setSelectedIds(new Set());
              } else {
                setSelectedIds(new Set(filteredCases.map((c) => c.id)));
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

function QueueTable({
  cases,
  selectedIds,
  onToggle,
  onToggleAll,
}: {
  cases: any[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
}) {
  const allSelected = cases.length > 0 && selectedIds.size === cases.length;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm min-w-[700px]">
        <thead>
          <tr className="bg-white text-slate-400 uppercase text-[9px] font-black tracking-widest border-b border-slate-100">
            <th className="px-4 py-4">
              <button
                onClick={onToggleAll}
                className="text-slate-400 hover:text-blue-600 transition-all"
              >
                {allSelected ? <CheckSquare size={15} /> : <Square size={15} />}
              </button>
            </th>
            <th className="px-6 py-4">Student</th>
            <th className="px-6 py-4">Nationality</th>
            <th className="px-6 py-4">Stage</th>
            <th className="px-6 py-4">Expiry Date</th>
            <th className="px-6 py-4">Risk Status</th>
            <th className="px-6 py-4 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {cases.map((item) => {
            const risk = getRiskState(item.permit_expiry_date);
            const styles = getStatusStyles(risk);
            const checked = selectedIds.has(item.id);
            return (
              <tr
                key={item.id}
                className={`hover:bg-slate-50/50 transition-all ${checked ? "bg-blue-50/40" : ""}`}
              >
                <td className="px-4 py-4">
                  <button
                    onClick={() => onToggle(item.id)}
                    className="text-slate-400 hover:text-blue-600 transition-all"
                  >
                    {checked ? (
                      <CheckSquare size={15} className="text-blue-600" />
                    ) : (
                      <Square size={15} />
                    )}
                  </button>
                </td>
                <td className="px-6 py-4">
                  <div className="font-black text-slate-900">
                    {item.students?.full_name}
                  </div>
                  <div className="text-slate-400 text-[10px] font-bold">
                    {item.students?.student_id}
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-500 text-xs font-bold">
                  {item.students?.nationality}
                </td>
                <td className="px-6 py-4">
                  <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-lg uppercase">
                    {item.current_stage?.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-500 text-xs font-bold">
                  {item.permit_expiry_date || "—"}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`px-4 py-1 rounded-full text-[9px] font-black uppercase border-2 ${styles}`}
                  >
                    {risk}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <Link
                    href={`/directory/${item.students?.id}`}
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
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}) {
  const colors: Record<string, string> = {
    blue: "bg-blue-600 text-white",
    red: "bg-red-500 text-white",
    amber: "bg-amber-500 text-white",
    emerald: "bg-emerald-500 text-white",
    orange: "bg-orange-500 text-white",
  };
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between group hover:border-blue-300 transition-all">
      <div>
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
          {title}
        </p>
        <h4 className="text-[2rem] leading-none font-black text-slate-900 tracking-tighter">
          {value}
        </h4>
      </div>
      <div
        className={`p-2.5 rounded-xl shadow-lg transition-all group-hover:scale-110 ${colors[color]}`}
      >
        {icon}
      </div>
    </div>
  );
}

function RiskDistributionChart({ cases }: { cases: any[] }) {
  const stats = calculateStats(cases);

  const data = [
    {
      name: "Compliant",
      value: stats.compliant,
      fill: "#10b981",
    },
    {
      name: "Expiring Soon",
      value: stats.expiringSoon,
      fill: "#f59e0b",
    },
    {
      name: "Expired",
      value: stats.expired,
      fill: "#ef4444",
    },
  ].filter((d) => d.value > 0);

  if (data.length === 0) {
    return (
      <p className="text-slate-400 text-sm font-medium text-center py-8">
        No cases yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-slate-500">Record count.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {data.map((item) => (
          <div
            key={item.name}
            className="border border-slate-200 rounded-2xl p-4 flex items-center justify-between"
          >
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
              {item.name}
            </span>
            <span
              className="text-3xl font-black text-slate-900"
              style={{ color: item.fill }}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function calculateStats(cases: any[]) {
  return {
    expired: cases.filter(
      (c) => getRiskState(c.permit_expiry_date) === "EXPIRED",
    ).length,
    expiringSoon: cases.filter(
      (c) => getRiskState(c.permit_expiry_date) === "EXPIRING_SOON",
    ).length,
    compliant: cases.filter(
      (c) => getRiskState(c.permit_expiry_date) === "COMPLIANT",
    ).length,
  };
}
