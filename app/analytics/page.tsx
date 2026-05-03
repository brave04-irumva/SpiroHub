"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getRiskState } from "@/utils/compliance";
import { BarChart2, Loader2, Globe, TrendingUp, PieChart as PieChartIcon } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
  Legend,
  LineChart,
  Line,
} from "recharts";

const STAGE_COLORS: Record<string, string> = {
  DOCUMENTS_PENDING: "#94a3b8",
  DOCUMENT_SUBMITTED: "#60a5fa",
  PAYMENT_MADE: "#2563eb",
  SUBMITTED_TO_IMMIGRATION: "#fb923c",
  AWAITING_COLLECTION: "#f59e0b",
  PASSPORT_COLLECTED: "#10b981",

  // Legacy aliases kept for backward compatibility with older records.
  DOCUMENTS_SUBMITTED: "#60a5fa",
  UNDER_REVIEW: "#a78bfa",
  APPROVED: "#34d399",
  COMPLETED: "#10b981",
};

const RISK_COLORS: Record<string, string> = {
  COMPLIANT: "#10b981",
  EXPIRING_SOON: "#f59e0b",
  EXPIRED: "#ef4444",
  UNKNOWN: "#94a3b8",
};

const CASE_TYPE_COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#f43f5e"];

export default function AnalyticsPage() {
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from("compliance_cases")
        .select("*, students(full_name, nationality)")
        .order("created_at", { ascending: true });
      if (data) setCases(data);
      setLoading(false);
    }
    fetch();
  }, []);

  if (loading)
    return (
      <div className="h-96 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );

  // — Cases by nationality
  const natMap: Record<string, number> = {};
  cases.forEach((c) => {
    const n = c.students?.nationality ?? "Unknown";
    natMap[n] = (natMap[n] ?? 0) + 1;
  });
  const nationalityData = Object.entries(natMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([name, value]) => ({ name, value }));

  // — Cases by case_type
  const typeMap: Record<string, number> = {};
  cases.forEach((c) => {
    const t = c.case_type?.replace(/_/g, " ") ?? "Unknown";
    typeMap[t] = (typeMap[t] ?? 0) + 1;
  });
  const caseTypeData = Object.entries(typeMap).map(([name, value]) => ({ name, value }));

  // — Cases by stage
  const stageMap: Record<string, number> = {};
  cases.forEach((c) => {
    const s = c.current_stage ?? "UNKNOWN";
    stageMap[s] = (stageMap[s] ?? 0) + 1;
  });
  const stageData = Object.entries(stageMap).map(([stage, count]) => ({
    name: stage.replace(/_/g, " "),
    count,
    fill: STAGE_COLORS[stage] ?? "#cbd5e1",
  }));

  // — Risk distribution
  const riskMap: Record<string, number> = {};
  cases.forEach((c) => {
    const r = getRiskState(c.permit_expiry_date);
    riskMap[r] = (riskMap[r] ?? 0) + 1;
  });
  const riskData = Object.entries(riskMap).map(([name, value]) => ({
    name: name.replace(/_/g, " "),
    value,
    fill: RISK_COLORS[name] ?? "#94a3b8",
  }));

  // — Monthly new cases
  const monthMap: Record<string, number> = {};
  cases.forEach((c) => {
    const m = new Date(c.created_at).toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    monthMap[m] = (monthMap[m] ?? 0) + 1;
  });
  const monthlyData = Object.entries(monthMap).map(([month, count]) => ({ month, count }));

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12 animate-in fade-in duration-700">
      {/* Header */}
      <div>
        <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-2">Insights</p>
        <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">
          Analytics
        </h1>
        <p className="text-slate-500 font-medium text-sm mt-2">
          Compliance data across all {cases.length} registered cases.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-7">
        {/* Cases by Nationality */}
        <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm p-7">
          <div className="flex items-center gap-2 mb-6">
            <Globe size={16} className="text-blue-600" />
            <h2 className="font-black text-slate-900 text-[10px] uppercase tracking-widest">
              Cases by Nationality
            </h2>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={nationalityData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fontWeight: 900, fill: "#94a3b8" }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fontWeight: 900, fill: "#64748b" }} width={90} />
                <Tooltip formatter={(v) => [`${v} cases`, "Count"]} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cases by Case Type */}
        <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm p-7">
          <div className="flex items-center gap-2 mb-6">
            <PieChartIcon size={16} className="text-blue-600" />
            <h2 className="font-black text-slate-900 text-[10px] uppercase tracking-widest">
              Cases by Type
            </h2>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={caseTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                  {caseTypeData.map((_, i) => (
                    <Cell key={i} fill={CASE_TYPE_COLORS[i % CASE_TYPE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pipeline Stage Distribution */}
        <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm p-7">
          <div className="flex items-center gap-2 mb-6">
            <BarChart2 size={16} className="text-blue-600" />
            <h2 className="font-black text-slate-900 text-[10px] uppercase tracking-widest">
              Pipeline Stage Distribution
            </h2>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageData} margin={{ bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 8, fontWeight: 900, fill: "#94a3b8", textAnchor: "end" }} angle={-35} interval={0} />
                <YAxis tick={{ fontSize: 10, fontWeight: 900, fill: "#94a3b8" }} allowDecimals={false} />
                <Tooltip formatter={(v) => [`${v} cases`, "Count"]} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {stageData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Intake */}
        <div className="bg-white border border-slate-200 rounded-[2rem] shadow-sm p-7">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp size={16} className="text-blue-600" />
            <h2 className="font-black text-slate-900 text-[10px] uppercase tracking-widest">
              Monthly Case Intake
            </h2>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 10, fontWeight: 900, fill: "#94a3b8" }} />
                <YAxis tick={{ fontSize: 10, fontWeight: 900, fill: "#94a3b8" }} allowDecimals={false} />
                <Tooltip formatter={(v) => [`${v} cases`, "New Cases"]} />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} dot={{ fill: "#3b82f6", r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
