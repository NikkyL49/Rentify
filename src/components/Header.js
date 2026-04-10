"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";

function useUnreadCount(user, enabled) {
  const [unread, setUnread] = useState(0);
  const seenIds = useRef(new Set());
  const pathname = usePathname();
  const onMessagesPage = pathname?.startsWith("/messages");

  useEffect(() => {
    if (!user || !enabled) { setUnread(0); return; }

    const channel = supabase
      .channel(`unread:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `recipient_id=eq.${user.id}` },
        (payload) => {
          const id = payload.new?.id;
          if (!id || seenIds.current.has(id)) return;
          seenIds.current.add(id);
          if (!document.location.pathname.startsWith("/messages")) {
            setUnread((n) => n + 1);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, enabled]);

  useEffect(() => {
    if (onMessagesPage) setUnread(0);
  }, [onMessagesPage]);

  return unread;
}

export default function Header() {
  // ── ALL hooks must be called unconditionally at the top ──
  const pathname  = usePathname();
  const router    = useRouter();
  const { user, isAdmin } = useAuth();
  const [search, setSearch] = useState("");

  const isAdminRoute = pathname?.startsWith("/dashboard") || pathname?.startsWith("/admin-login");

  // Pass enabled=false on admin routes so the subscription never opens
  const unread = useUnreadCount(user, !isAdminRoute);

  // Early return AFTER all hooks have been called
  if (isAdminRoute) return null;

  function nc(href) {
    const active = pathname === href || (href !== "/" && pathname?.startsWith(href));
    return `navLink${active ? " navLinkActive" : ""}`;
  }

  function handleSearch(e) {
    e.preventDefault();
    if (search.trim()) router.push(`/items?q=${encodeURIComponent(search.trim())}`);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <header className="appHeader">
      <nav className="navRow">
        <Link href="/" className="navBrand">RENTIFY</Link>

        <form onSubmit={handleSearch} className="headerSearch">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items..."
          />
        </form>

        <div className="navActions">
          <Link href="/locations" className={nc("/locations")}>Locations</Link>
          <Link href="/items" className={nc("/items")}>Browse</Link>

          {user ? (
            <>
              <Link href="/my-rentals" className={nc("/my-rentals")}>Rentals</Link>
              <Link href="/my-items" className={nc("/my-items")}>Listed</Link>

              <Link href="/messages" className={`${nc("/messages")} navMsgWrap`}>
                Messages
                {unread > 0 && (
                  <span className="navUnreadBadge" aria-label={`${unread} unread message${unread !== 1 ? "s" : ""}`}>
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>

              {isAdmin && (
                <Link href="/dashboard" className={`${nc("/dashboard")} navLinkAdmin`}>
                  Admin
                </Link>
              )}
              <Link href="/profile" className={`${nc("/profile")} navLinkAccount`}>Account</Link>
              <button onClick={logout} className="navLink navLinkLogout">Logout</button>
            </>
          ) : (
            <>
              <Link href="/login" className="navLinkLogin">Login</Link>
              <Link href="/admin-login" className="navLinkAdminPortal">Admin</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
