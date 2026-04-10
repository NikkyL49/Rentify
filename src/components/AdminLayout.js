"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

const ADMIN_LINKS = [
  { href: "/dashboard",           label: "Dashboard",  icon: "◼" },
  { href: "/dashboard/locations", label: "Locations",  icon: "📍" },
  { href: "/dashboard/items",     label: "Items",      icon: "📦" },
  { href: "/dashboard/rentals",   label: "Rentals",    icon: "🔑" },
  { href: "/dashboard/users",     label: "Users",      icon: "👤" },
];

function pageTitle(pathname) {
  if (pathname === "/dashboard")            return "Dashboard";
  if (pathname === "/dashboard/locations")  return "Locations";
  if (pathname === "/dashboard/items")      return "Items";
  if (pathname === "/dashboard/rentals")    return "Rentals";
  if (pathname === "/dashboard/users")      return "Users";
  return "Admin";
}

export function AdminLayout({ children }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { user, isAdmin, loading } = useAuth();

  // ── Single centralised auth guard for ALL dashboard pages ──
  // Runs after logout too — when isAdmin flips to false, redirect to admin-login
  useEffect(() => {
    if (loading) return;                          // wait for auth to resolve
    if (!user || !isAdmin) {
      router.replace("/admin-login");             // always go to admin login, not "/"
    }
  }, [loading, user, isAdmin, router]);

  const { profile } = useAuth();
  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || user?.email || "Admin";
  const initials    = displayName
    .split(" ")
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");

  async function logout() {
    await supabase.auth.signOut();
    // Don't manually push — the useEffect above will handle the redirect
    // as soon as AuthContext clears user/isAdmin
  }

  // Show nothing while auth is loading or user is being redirected
  if (loading || !user || !isAdmin) {
    return (
      <div className="dashboardShell" style={{ alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="dashboardShell">

      {/* ── Sidebar ──────────────────────────────────────── */}
      <aside className="adminSidebar">
        <div className="adminSidebarHeader">
          <span className="adminSidebarBrand">RENTIFY</span>
          <span className="adminSidebarTag">Admin</span>
        </div>
        <ul className="adminNav">
          {ADMIN_LINKS.map(({ href, label, icon }) => (
            <li
              key={href}
              className={`adminNavItem${pathname === href ? " active" : ""}`}
            >
              <Link href={href}>
                <span className="adminNavIcon">{icon}</span>
                {label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="adminSidebarFooter">
          <Link href="/" className="adminSidebarStudentLink">
            ← Student View
          </Link>
        </div>
      </aside>

      {/* ── Right panel: topbar + content ────────────────── */}
      <div className="adminMain">

        {/* Top bar */}
        <header className="adminTopbar">
          <div className="adminTopbarLeft">
            <span className="adminTopbarSection">Admin</span>
            <span className="adminTopbarSep">/</span>
            <span className="adminTopbarPage">{pageTitle(pathname)}</span>
          </div>

          <div className="adminTopbarRight">
            <div className="adminTopbarUser">
              <div className="adminAvatar">{initials || "A"}</div>
              <div className="adminTopbarUserInfo">
                <span className="adminTopbarName">{displayName}</span>
                <span className="adminTopbarRole">Administrator</span>
              </div>
              <button className="adminTopbarLogout" onClick={logout} title="Sign out">
                ⎋
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <div className="adminContent">{children}</div>
      </div>

    </div>
  );
}
