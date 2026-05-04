"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { getRiskState, getStatusStyles } from "@/utils/compliance";
import {
  AlertTriangle,
  Clock,
  CheckCircle,
  ShieldAlert,
  Loader2,
  Clock4,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchAlerts() {
    const { data, error } = await supabase
      .from("compliance_cases")
      .select(`*, students (*)`);

    if (data) {
      // Filter for only EXPIRED or EXPIRING_SOON
      const filtered = data.filter((c) => {
        const risk = getRiskState(c.permit_expiry_date);
        return risk === "EXPIRED" || risk === "EXPIRING_SOON";
      });
      setAlerts(filtered);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchAlerts();
  }, []);

  if (loading)
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-700 pb-8">
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-5">
        <div>
          <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em] mb-2">
            Priority Queue
          </p>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter leading-none">
            Compliance Alerts
          </h1>
        </div>
        <div className="bg-red-50 text-red-600 px-4 py-2 rounded-xl font-black text-[10px] uppercase border border-red-100 flex items-center gap-2">
          <ShieldAlert size={16} /> {alerts.length} Critical Issues
        </div>
      </div>

      {alerts.length > 0 ? (
        <div className="grid gap-3">
          {alerts.map((item) => {
            const risk = getRiskState(item.permit_expiry_date);
            const styles = getStatusStyles(risk);
            const isExpired = risk === "EXPIRED";

            return (
              <div
                key={item.id}
                className={`bg-white border-2 rounded-[2rem] p-5 transition-all flex flex-col md:flex-row items-center justify-between gap-5 hover:shadow-lg ${isExpired ? "border-red-100" : "border-amber-100"}`}
              >
                <div className="flex items-center gap-5">
                  <div
                    className={`h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 ${isExpired ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}
                  >
                    {isExpired ? (
                      <AlertTriangle size={28} />
                    ) : (
                      <Clock size={28} />
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 tracking-tight">
                      {item.students?.full_name}
                    </h3>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                      {item.students?.student_id} • {item.students?.nationality}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className={`px-3 py-0.5 rounded-full text-[9px] font-black uppercase border-2 ${styles}`}
                      >
                        {risk}
                      </span>
                      <span className="text-slate-400 text-[10px] font-bold">
                        Expires: {item.permit_expiry_date}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto">
                  <button
                    disabled
                    title="Requires verified domain — coming soon"
                    className="flex-1 md:flex-none bg-slate-200 text-slate-500 px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 cursor-not-allowed"
                  >
                    <Clock4 size={14} /> Email Coming Soon
                  </button>
                  <Link
                    href={`/directory/${item.students?.id}`}
                    className="flex-1 md:flex-none bg-slate-50 text-slate-900 px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-200 transition-all border border-slate-100"
                  >
                    Open File <ExternalLink size={14} />
                  </Link>
                </div>


              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-emerald-50 border-2 border-dashed border-emerald-100 rounded-[2rem] p-20 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-3xl text-emerald-500 shadow-xl shadow-emerald-500/10 mb-6">
            <CheckCircle size={40} />
          </div>
          <h3 className="text-2xl font-black text-emerald-900 tracking-tight">
            System Clear
          </h3>
          <p className="text-emerald-700 font-medium max-w-xs mx-auto mt-2">
            All student permits are currently up to date and outside the risk
            window.
          </p>
        </div>
      )}
    </div>
  );
}
