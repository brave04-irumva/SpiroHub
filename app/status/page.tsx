"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { getRiskState, getStatusStyles } from "@/utils/compliance";
import { Search, ShieldCheck, Clock, Loader2, Lock, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function StudentStatusPage() {
  const [studentId, setStudentId] = useState("");
  const [password, setPassword] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    // Step 1: Server-side lookup — converts admission number → email using service role key
    // This bypasses RLS safely on the server; only the email is returned, nothing else
    const lookupRes = await fetch("/api/student-lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: studentId.trim() }),
    });

    if (!lookupRes.ok) {
      setError("No record found for this Admission Number. Please check and try again.");
      setLoading(false);
      return;
    }

    const { email } = await lookupRes.json();

    // Step 2: Verify identity — sign in with the resolved email + entered password
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError("Incorrect password. Please use the password for your student account.");
      setLoading(false);
      return;
    }

    // Step 3: Now authenticated — fetch full student + case data
    const { data: studentData, error: dataError } = await supabase
      .from("students")
      .select(`*, compliance_cases (*)`)
      .eq("email", email)
      .single();

    // Step 4: Immediately sign out so no session lingers in this browser tab
    await supabase.auth.signOut();

    if (dataError || !studentData) {
      setError("Could not load your record. Please contact the International Office.");
      setLoading(false);
      return;
    }

    setResult(studentData);
    setLoading(false);
  }

  const currentCase = result?.compliance_cases?.[0];
  const risk = currentCase ? getRiskState(currentCase.permit_expiry_date) : null;
  const riskStyles = risk ? getStatusStyles(risk) : "";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#F8FAFC] animate-in fade-in duration-700">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-3xl bg-slate-900 text-blue-400 shadow-xl mb-4">
            <ShieldCheck size={32} />
          </div>
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-2">
            Student Status Check
          </p>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">SpiroHub Status</h1>
          <p className="text-slate-500 font-medium text-sm">Check your visa compliance progress securely.</p>
        </div>

        {!result ? (
          <form
            onSubmit={handleSearch}
            className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm space-y-5"
          >
            {error && (
              <div className="p-4 bg-red-50 text-red-700 rounded-2xl text-xs font-bold border border-red-100">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                <Search size={13} /> Admission Number
              </label>
              <input
                type="text"
                placeholder="e.g. 00-0001"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                required
                className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-xl font-bold text-sm outline-none focus:border-blue-600 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                <Lock size={13} /> Password
              </label>
              <input
                type="password"
                placeholder="Your student account password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-xl font-bold text-sm outline-none focus:border-blue-600 transition-all"
              />
              <p className="text-[10px] text-slate-400 font-medium px-1">
                Use the same password as your student portal login.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-blue-600 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <><Search size={16} /> Check My Status</>
              )}
            </button>

            <Link
              href="/login"
              className="flex items-center justify-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-900 transition-all"
            >
              <ArrowLeft size={13} /> Back to Login
            </Link>
          </form>
        ) : (
          <div className="space-y-4 animate-in zoom-in duration-500">
            <div className="bg-white border-4 border-slate-900 rounded-[1.75rem] p-7 shadow-2xl">
              <div className="space-y-6">
                <div className="border-b border-slate-100 pb-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Student Name</p>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">{result.full_name}</h3>
                  <p className="text-slate-400 text-xs font-bold mt-0.5">{result.student_id} · {result.nationality}</p>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-end">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Compliance Status</p>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black border-2 uppercase tracking-tighter ${riskStyles}`}>
                      {risk?.replace(/_/g, " ")}
                    </span>
                  </div>

                  <div className="p-5 bg-blue-50 rounded-2xl border-2 border-blue-100 flex items-center gap-4">
                    <div className="bg-blue-600 text-white p-2 rounded-lg shrink-0">
                      <Clock size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Pipeline Stage</p>
                      <p className="font-black text-blue-900 text-sm uppercase">
                        {currentCase?.current_stage?.replace(/_/g, " ") || "N/A"}
                      </p>
                    </div>
                  </div>

                  {currentCase?.permit_expiry_date && (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Permit Expiry</p>
                      <p className="font-black text-slate-900 text-sm">{currentCase.permit_expiry_date}</p>
                    </div>
                  )}

                  {currentCase?.efns_reference && (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">EFNS Reference</p>
                      <p className="font-mono font-black text-slate-900">{currentCase.efns_reference}</p>
                    </div>
                  )}
                </div>

                <div className="pt-2 text-center border-t border-slate-100">
                  <p className="text-[10px] text-slate-400 leading-relaxed font-medium">
                    If your status has not updated within 48 hours of submission, please visit the SPIRO.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => { setResult(null); setStudentId(""); setPassword(""); setError(""); }}
              className="w-full bg-slate-100 text-slate-500 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all"
            >
              Check Another
            </button>
          </div>
        )}
      </div>
    </div>
  );
}