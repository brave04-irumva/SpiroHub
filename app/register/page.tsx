"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { UserPlus, Mail, Loader2, CheckCircle } from "lucide-react";
import Link from "next/link";

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.email.endsWith("@daystar.ac.ke")) {
      alert("Constraint Violation: Only @daystar.ac.ke emails allowed.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: { data: { full_name: formData.fullName } },
    });

    if (!error) setSuccess(true);
    else alert(error.message);
    setLoading(false);
  }

  if (success)
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-6 text-center">
        <div className="bg-white border border-slate-200 rounded-[2rem] p-12 shadow-sm max-w-md">
          <CheckCircle size={60} className="text-emerald-500 mx-auto mb-6" />
          <h2 className="text-2xl font-black text-slate-900 mb-2">
            Registration Sent
          </h2>
          <p className="text-slate-500 font-bold mb-8">
            Check your email to verify your Daystar account.
          </p>
          <Link
            href="/login"
            className="bg-slate-900 text-white px-8 py-4 rounded-xl font-black text-xs uppercase tracking-widest"
          >
            Back to Login
          </Link>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-6">
      <div className="w-full max-w-md space-y-8 animate-in fade-in duration-700">
        <div className="text-center">
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">
            Join SpiroHub
          </h1>
          <p className="text-slate-500 font-bold mt-2">
            Create your student compliance profile.
          </p>
        </div>

        <form
          onSubmit={handleRegister}
          className="bg-white border border-slate-200 rounded-[2rem] p-10 shadow-sm space-y-6"
        >
          <input
            type="text"
            placeholder="Full Name"
            required
            value={formData.fullName}
            onChange={(e) =>
              setFormData({ ...formData, fullName: e.target.value })
            }
            className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-xl font-bold text-sm"
          />
          <input
            type="email"
            placeholder="name@daystar.ac.ke"
            required
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-xl font-bold text-sm"
          />
          <input
            type="password"
            placeholder="Create Password"
            required
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
            className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-xl font-bold text-sm"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-slate-900 transition-all"
          >
            {loading ? (
              <Loader2 className="animate-spin mx-auto" size={18} />
            ) : (
              "Create Account"
            )}
          </button>

          <p className="text-center text-[10px] font-black text-slate-400 uppercase">
            Already have an account?{" "}
            <Link href="/login" className="text-blue-600 hover:underline">
              Log In
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
