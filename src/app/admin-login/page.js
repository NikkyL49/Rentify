"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      // 1. Sign in
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;

      // 2. Fetch profile directly — don't rely on AuthContext which may not have loaded yet
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, is_banned")
        .eq("id", data.user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (profile?.is_banned) {
        await supabase.auth.signOut();
        setError("This account has been suspended.");
        return;
      }

      if (profile?.role !== "admin") {
        await supabase.auth.signOut();
        setError("Access denied. This portal is for administrators only.");
        return;
      }

      // 3. All good — go to dashboard
      router.replace("/dashboard");

    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="adminLoginPage">
      <div className="adminLoginCard">
        <div className="adminLoginHeader">
          <span className="adminLoginBrand">RENTIFY</span>
          <span className="adminLoginBadge">Admin Portal</span>
        </div>

        <p className="adminLoginSub">
          Sign in with your administrator credentials.
          <br />
          <a href="/login" className="adminLoginStudentLink">
            Student? Sign in here →
          </a>
        </p>

        {error && (
          <div className="adminLoginError" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="adminLoginForm">
          <div className="field">
            <label className="label">Admin Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@university.edu"
              required
              autoComplete="username"
            />
          </div>
          <div className="field">
            <label className="label">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            className="btn btnPrimary adminLoginBtn"
            disabled={saving}
          >
            {saving ? "Verifying..." : "Sign In to Dashboard"}
          </button>
        </form>

        <p className="adminLoginFootnote">
          Unauthorized access attempts are logged.
        </p>
      </div>
    </div>
  );
}
