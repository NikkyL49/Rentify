"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { supabase } from "@/lib/supabaseClient";
import {
  ensureProfileForUser,
  fullNameFromProfile,
  loadProfiles,
  userLabel,
} from "@/lib/profileHelpers";


function pairFilter(uidA, uidB) {
  return `and(sender_id.eq.${uidA},recipient_id.eq.${uidB}),and(sender_id.eq.${uidB},recipient_id.eq.${uidA})`;
}

async function fetchMessagesForUser(userId) {
  return supabase
    .from("messages")
    .select("*")
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order("created_at", { ascending: true });
}

export default function MessagesPage() {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  const [requestedUserId, setRequestedUserId] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setRequestedUserId(params.get("u") || "");
    }
  }, []);

  const [profiles, setProfiles] = useState([]);
  const [messages, setMessages] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeUserId, setActiveUserId] = useState(requestedUserId);
  const [mode, setMode] = useState(requestedUserId ? "thread" : "list");
  const [searchText, setSearchText] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const threadBottomRef = useRef(null);
  // Track which conversations have unread messages (sender ≠ me, arrived via realtime)
  const [unreadUsers, setUnreadUsers] = useState(new Set());

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([
      ensureProfileForUser(user),
      loadProfiles(),
      fetchMessagesForUser(user.id),
    ]).then(([ensureRes, profilesRes, messagesRes]) => {
      if (cancelled) return;
      if (ensureRes.error) console.error(ensureRes.error);
      if (profilesRes.error) {
        toast(profilesRes.error.message, "error");
      } else {
        setProfiles((profilesRes.data ?? []).filter((p) => p.id !== user.id));
      }
      if (messagesRes.error) {
        toast(messagesRes.error.message, "error");
      } else {
        setMessages(messagesRes.data ?? []);
      }
      setIsLoaded(true);
    });
    return () => { cancelled = true; };
  }, [user]);

  // ── Realtime subscription — auto-refresh on new INSERT ────────────────────
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`messages:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const row = payload.new;
          if (row.sender_id !== user.id && row.recipient_id !== user.id) return;
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row];
          });
          // If the message is FROM someone else and we're not in their thread, mark unread
          if (row.sender_id !== user.id) {
            setUnreadUsers((prev) => {
              const next = new Set(prev);
              next.add(row.sender_id);
              return next;
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // ── Auto-scroll to bottom of thread when messages change ─────────────────
  useEffect(() => {
    threadBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, mode]);

  const profilesById = Object.fromEntries(profiles.map((p) => [p.id, p]));

  function otherUserIdForMessage(row) {
    if (!user) return "";
    return row.sender_id === user.id ? row.recipient_id : row.sender_id;
  }

  const conversationMap = new Map();
  if (user) {
    for (const row of messages) {
      const otherId = otherUserIdForMessage(row);
      if (!otherId) continue;
      const prev = conversationMap.get(otherId);
      if (!prev || new Date(row.created_at) > new Date(prev.last.created_at)) {
        conversationMap.set(otherId, { otherUserId: otherId, last: row });
      }
    }
  }

  const conversations = Array.from(conversationMap.values()).sort(
    (a, b) => new Date(b.last.created_at) - new Date(a.last.created_at)
  );

  const activeThreadUserId =
    activeUserId && user && activeUserId !== user.id ? activeUserId : "";

  const activeThreadMessages = user && activeThreadUserId
    ? messages.filter((row) => {
        const pairA = row.sender_id === user.id && row.recipient_id === activeThreadUserId;
        const pairB = row.sender_id === activeThreadUserId && row.recipient_id === user.id;
        return pairA || pairB;
      })
    : [];

  const searchQuery = searchText.trim().toLowerCase();

  function labelForUserId(uid) {
    return userLabel(profilesById[uid], "", uid);
  }

  function secondaryForUserId(uid) {
    const profile = profilesById[uid];
    return fullNameFromProfile(profile) || profile?.email || uid;
  }

  const visibleConversations = searchQuery
    ? conversations.filter((c) => {
        const primary = labelForUserId(c.otherUserId).toLowerCase();
        const secondary = secondaryForUserId(c.otherUserId).toLowerCase();
        const preview = String(c.last.body ?? "").toLowerCase();
        return primary.includes(searchQuery) || secondary.includes(searchQuery) || preview.includes(searchQuery);
      })
    : conversations;

  const conversationUserIds = new Set(conversations.map((c) => c.otherUserId));
  const visibleNewUsers = searchQuery
    ? profiles.filter((p) => {
        if (conversationUserIds.has(p.id)) return false;
        const primary = userLabel(p, "", p.id).toLowerCase();
        const secondary = fullNameFromProfile(p).toLowerCase();
        const email = String(p.email ?? "").toLowerCase();
        return primary.includes(searchQuery) || secondary.includes(searchQuery) || email.includes(searchQuery);
      })
    : [];

  function openThread(targetUserId) {
    if (!user || !targetUserId || targetUserId === user.id) return;
    setActiveUserId(targetUserId);
    setMode("thread");
    // Clear unread for this conversation
    setUnreadUsers((prev) => {
      const next = new Set(prev);
      next.delete(targetUserId);
      return next;
    });
  }

  // ── Optimistic send ───────────────────────────────────────────────────────
  async function sendMessage(event) {
    event.preventDefault();
    if (!user || !activeThreadUserId) return;
    const trimmed = text.trim();
    if (!trimmed) return;

    // Optimistic update — show message immediately
    const optimistic = {
      id: `optimistic-${Date.now()}`,
      sender_id: user.id,
      recipient_id: activeThreadUserId,
      body: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setText("");
    setSending(true);

    try {
      const { error } = await supabase.from("messages").insert({
        sender_id: user.id,
        recipient_id: activeThreadUserId,
        body: trimmed,
      });
      if (error) throw error;
      // Realtime will deliver the real row; optimistic one gets deduped
    } catch (error) {
      // Roll back optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      toast(error instanceof Error ? error.message : "Failed to send message.", "error");
    } finally {
      setSending(false);
    }
  }

  async function deleteConversation() {
    if (!user || !activeThreadUserId) return;
    const ok = window.confirm(`Delete conversation with ${labelForUserId(activeThreadUserId)}?`);
    if (!ok) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("messages")
        .delete()
        .or(pairFilter(user.id, activeThreadUserId));
      if (error) throw error;
      setMessages((prev) =>
        prev.filter(
          (m) =>
            !(
              (m.sender_id === user.id && m.recipient_id === activeThreadUserId) ||
              (m.sender_id === activeThreadUserId && m.recipient_id === user.id)
            )
        )
      );
      setMode("list");
      setActiveUserId("");
      toast("Conversation deleted.", "info");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Failed to delete conversation.", "error");
    } finally {
      setDeleting(false);
    }
  }

  const inThread = mode === "thread" && !!activeThreadUserId;

  return (
    <div>
      <Header />
      <div className="container">
        {!inThread && (
          <section className="pageHead">
            <div>
              <h1 className="pageTitle">Messages</h1>
              <p className="pageSubtitle">Connect with other students.</p>
            </div>
            <span className="realtimeBadge" title="Live updates enabled">● Live</span>
          </section>
        )}

        {loading ? (
          <div className="centerNotice">Loading messages...</div>
        ) : !user ? (
          <div className="centerNotice">
            Please <Link href="/login">log in</Link> to view messages.
          </div>
        ) : !isLoaded ? (
          <div className="centerNotice">Loading conversations...</div>
        ) : inThread ? (
          <section className="threadCard">
            <div className="threadHeader">
              <div>
                <h2 className="threadHeaderName">{labelForUserId(activeThreadUserId)}</h2>
                <p className="chatPreview threadHeaderSub">
                  {secondaryForUserId(activeThreadUserId)}
                </p>
              </div>
              <div className="actions threadActionsRow">
                <button type="button" className="btn btnGhost" onClick={() => setMode("list")}>
                  Back
                </button>
                <button type="button" className="btn btnDanger" onClick={deleteConversation} disabled={deleting}>
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>

            <div className="threadMessages">
              {activeThreadMessages.length === 0 ? (
                <div className="centerNotice">No messages yet. Say hi!</div>
              ) : (
                activeThreadMessages.map((row) => {
                  const mine = row.sender_id === user.id;
                  const isOptimistic = String(row.id).startsWith("optimistic-");
                  return (
                    <div key={row.id} className={`bubbleWrap ${mine ? "bubbleWrapMine" : ""}`}>
                      <div className={`bubble ${mine ? "bubbleMine" : "bubbleOther"} ${isOptimistic ? "bubbleOptimistic" : ""}`}>
                        {row.body}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={threadBottomRef} />
            </div>

            <form className="composer" onSubmit={sendMessage}>
              <input
                placeholder="Type a message"
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={sending || deleting}
                required
                aria-label="Message text"
              />
              <button type="submit" className="btn btnPrimary" disabled={sending || deleting}>
                {sending ? "..." : "Send"}
              </button>
            </form>
          </section>
        ) : (
          <section className="chatList">
            <div className="field">
              <input
                placeholder="Search conversations or students"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                aria-label="Search conversations"
              />
            </div>

            {visibleConversations.length === 0 && visibleNewUsers.length === 0 ? (
              searchQuery ? (
                <div className="centerNotice">No conversations or students found.</div>
              ) : (
                <div className="centerNotice">No messages yet. Use search to start a conversation.</div>
              )
            ) : (
              <>
                {visibleConversations.map((c) => (
                  <button
                    key={c.otherUserId}
                    type="button"
                    className={`chatRow ${activeUserId === c.otherUserId ? "chatRowActive" : ""} ${unreadUsers.has(c.otherUserId) ? "chatRowUnread" : ""}`}
                    onClick={() => openThread(c.otherUserId)}
                  >
                    <div className="chatTop">
                      <p className="chatName">{labelForUserId(c.otherUserId)}</p>
                      {unreadUsers.has(c.otherUserId) && (
                        <span className="chatUnreadDot" aria-label="Unread messages" />
                      )}
                    </div>
                    <p className="chatPreview chatPreviewUnread">{c.last.body}</p>
                  </button>
                ))}

                {visibleNewUsers.length > 0 && (
                  <>
                    <p className="label chatStartLabel">Start a conversation</p>
                    {visibleNewUsers.map((profile) => (
                      <button
                        key={profile.id}
                        type="button"
                        className="chatRow"
                        onClick={() => openThread(profile.id)}
                      >
                        <div className="chatTop">
                          <p className="chatName">{userLabel(profile, "", profile.id)}</p>
                        </div>
                        <p className="chatPreview">
                          {fullNameFromProfile(profile) || profile.email || profile.id}
                        </p>
                      </button>
                    ))}
                  </>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
