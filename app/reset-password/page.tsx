"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { ShieldCheck, Lock, Loader2, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
    } else {
      setDone(true);
      setTimeout(() => router.replace("/login"), 3000);
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
            New Password
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-2">
            Choose a strong password for your account.
          </p>
        </div>

        {done ? (
          <div className="bg-white border border-slate-200 rounded-[2rem] p-10 shadow-sm text-center space-y-4">
            <div className="inline-flex items-center justify-center h-16 w-16 bg-emerald-50 rounded-2xl text-emerald-500 mx-auto">
              <CheckCircle2 size={32} />
            </div>
            <h2 className="font-black text-slate-900 text-lg uppercase tracking-tight">
              Password Updated
            </h2>
            <p className="text-slate-500 text-sm font-medium">
              Redirecting you to login…
            </p>
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

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                  <Lock size={14} /> New Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-xl font-bold text-sm outline-none focus:border-blue-600 transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                  <Lock size={14} /> Confirm Password
                </label>
                <input
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-xl font-bold text-sm outline-none focus:border-blue-600 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-blue-600 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                "Update Password"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
