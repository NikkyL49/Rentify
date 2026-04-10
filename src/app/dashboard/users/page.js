"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

const AUTO_BAN_ONE_STAR_THRESHOLD = 5;
const AUTO_BAN_LATE_DAYS_THRESHOLD = 15;

export default function AdminUsersPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [users, setUsers] = useState([]);
  const [ratingMap, setRatingMap] = useState({});   // userId → { avg, oneStarCount, total }
  const [rentalMap, setRentalMap] = useState({});   // userId → { active, overdue, total }
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");       // all | active | banned | flagged
  const [banTarget, setBanTarget] = useState(null);  // user object to ban
  const [banReason, setBanReason] = useState("");

  useEffect(() => { if (!authLoading && (!user || !isAdmin)) router.push("/"); }, [authLoading, user, isAdmin, router]);
  useEffect(() => { load(); }, []);

  if (authLoading) return <div><div className="centerNotice">Loading...</div></div>;
  if (!isAdmin) return null;

  async function load() {
    setLoaded(false);
    const [profilesRes, ratingsRes, rentalsRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("ratings").select("seller_id, rating"),
      supabase.from("rental_transactions").select("renter_id, status, expected_return_date"),
    ]);

    const profiles = profilesRes.data ?? [];
    const ratings  = ratingsRes.data ?? [];
    const rentals  = rentalsRes.data ?? [];
    const now      = new Date();

    // Build rating map
    const rm = {};
    for (const r of ratings) {
      if (!rm[r.seller_id]) rm[r.seller_id] = { total: 0, sum: 0, oneStarCount: 0 };
      rm[r.seller_id].total++;
      rm[r.seller_id].sum += r.rating;
      if (r.rating === 1) rm[r.seller_id].oneStarCount++;
    }
    for (const id of Object.keys(rm)) {
      rm[id].avg = (rm[id].sum / rm[id].total).toFixed(1);
    }

    // Build rental map
    const rnm = {};
    for (const r of rentals) {
      if (!rnm[r.renter_id]) rnm[r.renter_id] = { total: 0, active: 0, overdue: 0 };
      rnm[r.renter_id].total++;
      if (r.status === "active") {
        rnm[r.renter_id].active++;
        if (new Date(r.expected_return_date) < now) rnm[r.renter_id].overdue++;
      }
    }

    setUsers(profiles);
    setRatingMap(rm);
    setRentalMap(rnm);
    setLoaded(true);
  }

  // A user is "flagged" if they have ≥ AUTO_BAN_ONE_STAR_THRESHOLD - 1 one-star ratings
  // (approaching the auto-ban threshold) or any overdue rentals
  function isFlagged(u) {
    const r = ratingMap[u.id];
    const rn = rentalMap[u.id];
    if (r?.oneStarCount >= AUTO_BAN_ONE_STAR_THRESHOLD - 1) return true;
    if (rn?.overdue > 0) return true;
    return false;
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (filter === "banned" && !u.is_banned) return false;
      if (filter === "active" && u.is_banned) return false;
      if (filter === "flagged" && (!isFlagged(u) || u.is_banned)) return false;
      if (q) {
        const name = `${u.first_name ?? ""} ${u.last_name ?? ""}`.toLowerCase();
        const email = (u.email ?? "").toLowerCase();
        if (!name.includes(q) && !email.includes(q)) return false;
      }
      return true;
    });
  }, [users, filter, search, ratingMap, rentalMap]);

  async function confirmBan() {
    if (!banTarget) return;
    const { error } = await supabase
      .from("profiles")
      .update({ is_banned: true, ban_reason: banReason || "Manually banned by admin." })
      .eq("id", banTarget.id);
    if (error) { toast(error.message, "error"); return; }

    // Notify user via message
    await supabase.from("messages").insert({
      sender_id: banTarget.id,
      recipient_id: banTarget.id,
      body: `⚠️ Your account has been suspended by an administrator. Reason: ${banReason || "Policy violation."}`,
    });

    toast(`${banTarget.first_name ?? banTarget.email} has been banned.`, "info");
    setBanTarget(null);
    setBanReason("");
    load();
  }

  async function unban(u) {
    const { error } = await supabase
      .from("profiles")
      .update({ is_banned: false, ban_reason: null })
      .eq("id", u.id);
    if (error) { toast(error.message, "error"); return; }

    // Notify user via message
    await supabase.from("messages").insert({
      sender_id: u.id,
      recipient_id: u.id,
      body: "✅ Your account suspension has been lifted. You can now use Rentify again.",
    });

    toast(`${u.first_name ?? u.email} has been unbanned.`, "success");
    load();
  }

  const flaggedCount = users.filter((u) => isFlagged(u) && !u.is_banned).length;
  const bannedCount  = users.filter((u) => u.is_banned).length;

  return (
    <div>
      <AdminLayout>
        <div className="adminPageHead">
          <h1 className="adminPageH1Mb">Manage Users</h1>
          <div className="adminPageMeta">
            {bannedCount > 0 && <span className="badge badgeRed">{bannedCount} banned</span>}
            {flaggedCount > 0 && <span className="badge badgeOrange">{flaggedCount} flagged</span>}
          </div>
        </div>

        {/* Filters */}
        <div className="adminFilterRow">
          <input
            className="adminSearchInput"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="filterPills">
            {[
              { id: "all",     label: "All" },
              { id: "active",  label: "Active" },
              { id: "flagged", label: `Flagged${flaggedCount > 0 ? ` (${flaggedCount})` : ""}` },
              { id: "banned",  label: `Banned${bannedCount > 0 ? ` (${bannedCount})` : ""}` },
            ].map((f) => (
              <button
                key={f.id}
                className={`pill${filter === f.id ? " pillActive" : ""}`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card adminTableCard">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Avg Rating</th>
                <th>1★ Count</th>
                <th>Active Rentals</th>
                <th>Overdue</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loaded ? (
                <tr><td colSpan={9} className="adminTableEmpty">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="adminTableEmpty">No users found.</td></tr>
              ) : filtered.map((u) => {
                const r  = ratingMap[u.id];
                const rn = rentalMap[u.id];
                const flagged = isFlagged(u);
                return (
                  <tr
                    key={u.id}
                    className={u.is_banned ? "adminTrBanned" : flagged ? "adminTrFlagged" : ""}
                  >
                    <td className="adminTdBold">
                      {u.first_name} {u.last_name}
                      {flagged && !u.is_banned && (
                        <span className="adminFlagBadge" title="Flagged: approaching ban threshold or has overdue rentals">
                          ⚠
                        </span>
                      )}
                    </td>
                    <td className="adminTdMuted">{u.email}</td>
                    <td className="adminTdCapitalize">{u.role ?? "student"}</td>
                    <td>
                      {r ? (
                        <span style={{ color: Number(r.avg) < 3 ? "var(--danger)" : "inherit" }}>
                          {r.avg} ★ <span className="adminTdMuted">({r.total})</span>
                        </span>
                      ) : "—"}
                    </td>
                    <td>
                      {r?.oneStarCount > 0 ? (
                        <span style={{ color: r.oneStarCount >= AUTO_BAN_ONE_STAR_THRESHOLD ? "var(--danger)" : r.oneStarCount >= AUTO_BAN_ONE_STAR_THRESHOLD - 1 ? "var(--warning)" : "inherit", fontWeight: 600 }}>
                          {r.oneStarCount}
                          {r.oneStarCount >= AUTO_BAN_ONE_STAR_THRESHOLD && " (auto-banned)"}
                        </span>
                      ) : "—"}
                    </td>
                    <td>{rn?.active ?? 0}</td>
                    <td>
                      {rn?.overdue > 0 ? (
                        <span style={{ color: "var(--danger)", fontWeight: 600 }}>{rn.overdue}</span>
                      ) : "—"}
                    </td>
                    <td>
                      <span className={`badge ${u.is_banned ? "badgeRed" : "badgeGreen"}`}>
                        {u.is_banned ? "Banned" : "Active"}
                      </span>
                      {u.ban_reason && (
                        <p className="adminBanReason" title={u.ban_reason}>
                          {u.ban_reason.length > 40 ? u.ban_reason.slice(0, 40) + "…" : u.ban_reason}
                        </p>
                      )}
                    </td>
                    <td>
                      {u.is_banned ? (
                        <button className="btn btnSm btnPrimary" onClick={() => unban(u)}>
                          Unban
                        </button>
                      ) : (
                        <button className="btn btnSm btnDanger" onClick={() => { setBanTarget(u); setBanReason(""); }}>
                          Ban
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Auto-ban policy callout */}
        <div className="adminInfoBox">
          <p className="adminInfoTitle">Auto-Ban Policy</p>
          <p className="adminInfoText">
            Users are automatically suspended when they receive{" "}
            <strong>{AUTO_BAN_ONE_STAR_THRESHOLD} or more one-star ratings</strong>, or when an admin processes
            a return that is <strong>{AUTO_BAN_LATE_DAYS_THRESHOLD}+ days overdue</strong>. Flagged (⚠) users are
            approaching the threshold. You can manually unban any user above.
          </p>
        </div>
      </AdminLayout>

      {/* Ban confirmation modal */}
      {banTarget && (
        <div className="modalOverlay" onClick={() => setBanTarget(null)}>
          <div className="modalCard" onClick={(e) => e.stopPropagation()}>
            <h2 className="modalTitle">Ban User</h2>
            <p className="modalSub">
              You are about to ban <strong>{banTarget.first_name} {banTarget.last_name}</strong>{" "}
              ({banTarget.email}). They will be notified via message.
            </p>
            <div className="field">
              <label className="label">Reason <span style={{ color: "var(--text-muted)" }}>(optional)</span></label>
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="e.g. Multiple 1-star complaints from renters"
                rows={3}
              />
            </div>
            <div className="actions">
              <button className="btn btnDanger" onClick={confirmBan}>Confirm Ban</button>
              <button className="btn btnGhost" onClick={() => setBanTarget(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
