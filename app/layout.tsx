"use client";

import "./globals.css";
import React, { useState, useEffect } from "react";
import { Inter } from "next/font/google";
import {
  LayoutDashboard,
  Users,
  Bell,
  Settings,
  LogOut,
  Loader2,
  Activity,
  BarChart2,
  ClipboardList,
  Moon,
  Sun,
  Menu,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const inter = Inter({ subsets: ["latin"] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#F8FAFC] text-slate-900`}>
        <InnerLayout>{children}</InnerLayout>
      </body>
    </html>
  );
}

function InnerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [officer, setOfficer] = useState<{
    full_name: string;
    role: string;
    initials: string;
  } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [uploadBadge, setUploadBadge] = useState(0);
  const [darkMode, setDarkMode] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Persist dark mode across sessions
  useEffect(() => {
    const saved = localStorage.getItem("spiro_dark_mode") === "true";
    setDarkMode(saved);
    if (saved) document.documentElement.classList.add("dark");
  }, []);

  function toggleDarkMode() {
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem("spiro_dark_mode", String(next));
    document.documentElement.classList.toggle("dark", next);
  }

  const isAuthPage =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/status" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname.startsWith("/student");

  useEffect(() => {
    if (isAuthPage) {
      setAuthChecked(true);
      return;
    }

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("officers")
        .select("full_name, role")
        .eq("email", session.user.email)
        .single();

      if (profile) {
        const initials = profile.full_name
          .split(" ")
          .map((n: string) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase();
        setOfficer({ full_name: profile.full_name, role: profile.role, initials });
      }

      setAuthChecked(true);
    }

    checkSession();

    // Poll for new student uploads every 30s
    async function fetchUploadBadge() {
      const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("case_events")
        .select("*", { count: "exact", head: true })
        .eq("event_type", "DOCUMENT_UPLOADED")
        .gte("created_at", since);
      setUploadBadge(count ?? 0);
    }
    fetchUploadBadge();
    const pollInterval = setInterval(fetchUploadBadge, 30000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/login");
    });

    return () => {
      subscription.unsubscribe();
      clearInterval(pollInterval);
    };
  }, [isAuthPage, router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (isAuthPage) {
    return <div className="min-h-screen">{children}</div>;
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`w-64 bg-[#0F172A] text-slate-400 p-6 flex flex-col fixed h-full shadow-xl z-50 transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="mb-12 px-2">
          <span className="text-white font-black text-xl tracking-tighter uppercase">
            SpiroHub
          </span>
        </div>

        <nav className="space-y-1 flex-1">
          <NavItem href="/" icon={<LayoutDashboard size={18} />} label="Dashboard" onNavigate={() => setSidebarOpen(false)} />
          <NavItem href="/directory" icon={<Users size={18} />} label="Directory" badge={uploadBadge} onNavigate={() => setSidebarOpen(false)} />
          <NavItem href="/alerts" icon={<Bell size={18} />} label="Alerts" onNavigate={() => setSidebarOpen(false)} />
          <NavItem href="/activity" icon={<Activity size={18} />} label="Activity" onNavigate={() => setSidebarOpen(false)} />
          <NavItem href="/analytics" icon={<BarChart2 size={18} />} label="Analytics" onNavigate={() => setSidebarOpen(false)} />
          {officer?.role === "ADMIN" && (
            <NavItem href="/audit" icon={<ClipboardList size={18} />} label="Audit Log" onNavigate={() => setSidebarOpen(false)} />
          )}
          {officer?.role === "ADMIN" && (
            <NavItem href="/settings" icon={<Settings size={18} />} label="Settings" onNavigate={() => setSidebarOpen(false)} />
          )}
        </nav>

        <div className="pt-6 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <LogOut size={16} className="shrink-0" />
            <span className="text-[9px] font-black uppercase tracking-widest">
              Sign Out
            </span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 md:ml-64 p-4 md:p-10 min-h-screen w-full">
        <header className="flex justify-between md:justify-end items-center mb-6 md:mb-10">
          {/* Hamburger — mobile only */}
          <button
            className="md:hidden flex items-center justify-center h-10 w-10 rounded-xl bg-[#0F172A] text-white shadow"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          {officer && (
            <div className="flex items-center gap-3">
              <button
                onClick={toggleDarkMode}
                title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
                className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:text-blue-600 hover:border-blue-300 transition-all shadow-sm"
              >
                {darkMode ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
                <div className="text-right">
                  <p className="text-[9px] font-black text-blue-600 uppercase leading-none tracking-widest">
                    {officer.role}
                  </p>
                  <p className="text-xs font-bold text-slate-900 mt-1">
                    {officer.full_name}
                  </p>
                </div>
                <div className="h-10 w-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black text-xs uppercase shadow-lg">
                  {officer.initials}
                </div>
              </div>
            </div>
          )}
        </header>
        <div className="max-w-full overflow-x-hidden">{children}</div>
      </main>
    </div>
  );
}

function NavItem({
  href,
  icon,
  label,
  badge,
  onNavigate,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`relative flex items-center gap-4 px-4 py-3 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all group ${
        isActive
          ? "bg-blue-600 text-white shadow-xl shadow-blue-600/30"
          : "hover:bg-slate-800 hover:text-white text-slate-500"
      }`}
    >
      <span
        className={`absolute left-1 top-1/2 h-7 w-1 -translate-y-1/2 rounded-full transition-all ${
          isActive ? "bg-white/90" : "bg-transparent group-hover:bg-slate-500"
        }`}
      />
      {icon} {label}
      {badge != null && badge > 0 && (
        <span className="ml-auto bg-blue-500 text-white text-[8px] font-black rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
          {badge > 9 ? "9+" : badge}
        </span>
      )}
    </Link>
  );
}
