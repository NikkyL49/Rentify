"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

const ADMIN_LINKS = [
  { href: "/dashboard",           label: "Dashboard",  icon: "◼" },
  { href: "/dashboard/locations", label: "Locations",  icon: "📍" },
  { href: "/dashboard/items",     label: "Items",      icon: "📦" },
  { href: "/dashboard/rentals",   label: "Rentals",    icon: "🔑" },
  { href: "/dashboard/users",     label: "Users",      icon: "👤" },
];

// Maps /dashboard/xxx → page name for the top bar breadcrumb
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
  const { user, profile } = useAuth();

  async function logout() {
    await supabase.auth.signOut();
    router.push("/admin-login");
  }

  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || user?.email || "Admin";
  const initials    = displayName
    .split(" ")
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");

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
          {/* Left: breadcrumb */}
          <div className="adminTopbarLeft">
            <span className="adminTopbarSection">Admin</span>
            <span className="adminTopbarSep">/</span>
            <span className="adminTopbarPage">{pageTitle(pathname)}</span>
          </div>

          {/* Right: student view shortcut + avatar dropdown */}
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
