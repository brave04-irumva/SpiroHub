"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Activity, Loader2, Filter, User, Calendar } from "lucide-react";

const EVENT_DOT: Record<string, string> = {
  DOCUMENT_UPLOADED: "bg-purple-500",
  DOC_REQUEST: "bg-amber-500",
  UPDATE: "bg-blue-500",
  EMAIL_SENT: "bg-emerald-500",
  UPLOAD: "bg-purple-500",
  NOTE: "bg-slate-400",
  EXPIRY_DATE_PROPOSED: "bg-orange-400",
  STUDENT_MESSAGE: "bg-pink-500",
  STAGE_CHANGE: "bg-blue-600",
};

export default function ActivityFeedPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    async function fetchEvents() {
      const { data } = await supabase
        .from("case_events")
        .select("*, compliance_cases(id, current_stage, students(full_name, student_id))")
        .order("created_at", { ascending: false })
        .limit(300);
      if (data) setEvents(data);
      setLoading(false);
    }
    fetchEvents();
  }, []);

  const eventTypes = ["ALL", ...Array.from(new Set(events.map((e) => e.event_type))).sort()];
  const filtered = filter === "ALL" ? events : events.filter((e) => e.event_type === filter);

  // Group by date
  const grouped: Record<string, any[]> = {};
  filtered.forEach((event) => {
    const date = new Date(event.created_at).toLocaleDateString("en-KE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(event);
  });

  if (loading)
    return (
      <div className="h-96 flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12 animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5">
        <div>
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-2">
            Real-time
          </p>
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">
            Activity Feed
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-2">
            All case events across every student, newest first.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={13} className="text-slate-400 shrink-0" />
          {eventTypes.slice(0, 8).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl transition-all ${
                filter === type
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {type.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      {Object.entries(grouped).length === 0 ? (
        <div className="text-center py-24 text-slate-400 font-bold text-sm uppercase tracking-widest">
          <Activity size={40} className="mx-auto mb-4 opacity-20" />
          No events found.
        </div>
      ) : (
        <div className="space-y-10">
          {Object.entries(grouped).map(([date, dayEvents]) => (
            <div key={date}>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                <Calendar size={12} /> {date}
              </p>
              <div className="space-y-3">
                {dayEvents.map((event) => {
                  const student = event.compliance_cases?.students;
                  const dot = EVENT_DOT[event.event_type] ?? "bg-blue-500";
                  return (
                    <div
                      key={event.id}
                      className="bg-white border border-slate-100 rounded-2xl p-5 flex gap-4 items-start hover:border-slate-200 transition-all shadow-sm"
                    >
                      <div className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-bold text-slate-800 leading-snug">
                            {event.description}
                          </p>
                          <span className="text-[9px] text-slate-400 font-black shrink-0 tabular-nums">
                            {new Date(event.created_at).toLocaleTimeString("en-KE", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-[9px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded-lg">
                            {event.event_type?.replace(/_/g, " ")}
                          </span>
                          {student && (
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                              <User size={10} />
                              {student.full_name} · {student.student_id}
                            </span>
                          )}
                          <span className="text-[9px] text-slate-400 font-bold">
                            by {event.actor_name ?? "System"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
