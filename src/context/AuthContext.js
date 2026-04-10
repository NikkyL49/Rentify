"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const AuthContext = createContext({
  user: null,
  session: null,
  profile: null,
  isAdmin: false,
  isBanned: false,
  loading: true,
});

/** Stale/invalid refresh token error codes from Supabase */
const STALE_TOKEN_MESSAGES = [
  "Invalid Refresh Token",
  "Refresh Token Not Found",
  "refresh_token_not_found",
  "invalid_grant",
];

function isStaleTokenError(error) {
  if (!error) return false;
  const msg = String(error?.message ?? error).toLowerCase();
  return STALE_TOKEN_MESSAGES.some((s) => msg.includes(s.toLowerCase()));
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(userId) {
    if (!userId) { setProfile(null); return; }
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      // Don't log profile fetch errors to console — not actionable for user
      setProfile(null);
      return;
    }
    setProfile(data ?? null);
  }

  function clearAuth() {
    setSession(null);
    setUser(null);
    setProfile(null);
  }

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data, error }) => {
      if (!active) return;

      // Stale refresh token — silently sign out and clear state
      // This prevents the noisy "Invalid Refresh Token" console error
      if (isStaleTokenError(error)) {
        await supabase.auth.signOut();
        clearAuth();
        if (active) setLoading(false);
        return;
      }

      if (error) {
        // Other auth errors — still clear state but don't crash
        clearAuth();
        if (active) setLoading(false);
        return;
      }

      const nextSession = data.session ?? null;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      fetchProfile(nextSession?.user?.id ?? null).finally(() => {
        if (active) setLoading(false);
      });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, nextSession) => {
        if (!active) return;

        // TOKEN_REFRESHED failure — stale token, clear quietly
        if (event === "TOKEN_REFRESHED" && !nextSession) {
          await supabase.auth.signOut();
          clearAuth();
          if (active) setLoading(false);
          return;
        }

        // SIGNED_OUT — clear everything cleanly
        if (event === "SIGNED_OUT") {
          clearAuth();
          if (active) setLoading(false);
          return;
        }

        setSession(nextSession ?? null);
        setUser(nextSession?.user ?? null);
        fetchProfile(nextSession?.user?.id ?? null).finally(() => {
          if (active) setLoading(false);
        });
      }
    );

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const isAdmin  = profile?.role === "admin";
  const isBanned = profile?.is_banned === true;

  return (
    <AuthContext.Provider value={{ user, session, profile, isAdmin, isBanned, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
