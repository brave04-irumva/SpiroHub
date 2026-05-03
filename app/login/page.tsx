"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Lock,
  Mail,
  Loader2,
  ArrowRight,
  Eye,
  EyeOff,
  Search,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage("");
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    // Check user role in our custom officers table
    const { data: profile } = await supabase
      .from("officers")
      .select("role")
      .eq("email", email.trim().toLowerCase())
      .single();

    if (profile?.role === "ADMIN" || profile?.role === "OFFICER") {
      router.push("/");
    } else {
      // Check if they're a registered student
      const { data: studentProfile } = await supabase
        .from("students")
        .select("id")
        .eq("email", email.trim().toLowerCase())
        .single();

      if (studentProfile) {
        router.push("/student");
      } else {
        setErrorMessage(
          "No officer or student record found for this account. Contact the International Office.",
        );
        await supabase.auth.signOut();
      }
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-6">
      <div className="w-full max-w-md space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="text-center">
          <Image
            src="/dupo-logo.png"
            alt="SpiroHub"
            width={130}
            height={130}
            className="mx-auto mb-6 h-auto"
            priority
          />
          <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">
            SpiroHub
          </h1>
        </div>

        <form
          onSubmit={handleLogin}
          className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm space-y-6"
        >
          {errorMessage && (
            <div className="p-4 bg-red-50 text-red-700 rounded-2xl text-xs font-bold border border-red-100">
              {errorMessage}
            </div>
          )}

          <div className="space-y-4">
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

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                <Lock size={14} /> Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border-2 border-slate-100 p-4 pr-12 rounded-xl font-bold text-sm outline-none focus:border-blue-600 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
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
              <>
                Sign In <ArrowRight size={18} />
              </>
            )}
          </button>

          <div className="flex justify-center">
            <Link
              href="/forgot-password"
              className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-all"
            >
              Forgot password?
            </Link>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-widest">
              <span className="bg-white px-3 text-slate-400 font-black">
                or
              </span>
            </div>
          </div>

          <Link
            href="/status"
            className="w-full flex items-center justify-center gap-2 border-2 border-slate-200 text-slate-600 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:border-blue-600 hover:text-blue-600 transition-all"
          >
            <Search size={14} /> Check My Visa Status
          </Link>
        </form>
      </div>
    </div>
  );
}
