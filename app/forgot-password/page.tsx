"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { ShieldCheck, Mail, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/reset-password` }
    );

    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-6">
      <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="text-center">
          <div className="inline-flex p-4 bg-blue-600 rounded-2xl shadow-xl shadow-blue-500/20 mb-6 text-white">
            <ShieldCheck size={40} />
          </div>
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-2">
            Account Recovery
          </p>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">
            Reset Password
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-2">
            We'll send a reset link to your university email.
          </p>
        </div>

        {sent ? (
          <div className="bg-white border border-slate-200 rounded-[2rem] p-10 shadow-sm text-center space-y-4">
            <div className="inline-flex items-center justify-center h-16 w-16 bg-emerald-50 rounded-2xl text-emerald-500 mx-auto">
              <CheckCircle2 size={32} />
            </div>
            <h2 className="font-black text-slate-900 text-lg uppercase tracking-tight">
              Check Your Inbox
            </h2>
            <p className="text-slate-500 text-sm font-medium">
              A password reset link has been sent to{" "}
              <span className="font-black text-slate-900">{email}</span>. Check
              your spam folder if it doesn't arrive within a few minutes.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-blue-600 font-black text-xs uppercase tracking-widest hover:text-slate-900 transition-all mt-2"
            >
              <ArrowLeft size={14} /> Back to Login
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm space-y-6"
          >
            {error && (
              <div className="p-4 bg-red-50 text-red-700 rounded-2xl text-xs font-bold border border-red-100">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                <Mail size={14} /> University Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@daystar.ac.ke"
                className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-xl font-bold text-sm outline-none focus:border-blue-600 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-blue-600 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                "Send Reset Link"
              )}
            </button>

            <Link
              href="/login"
              className="flex items-center justify-center gap-2 text-slate-400 font-black text-[10px] uppercase tracking-widest hover:text-slate-900 transition-all"
            >
              <ArrowLeft size={13} /> Back to Login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
