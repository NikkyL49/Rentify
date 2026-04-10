"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { ensureProfileForUser } from "@/lib/profileHelpers";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [banned, setBanned] = useState(false);

  // Only redirect if we finished signing in via the form (not on every user change)
  // We handle redirect manually after ban check below

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage(""); setBanned(false); setSaving(true);
    try {
      if (mode === "signup") {
        if (!firstName.trim() || !lastName.trim()) { setMessage("Name required."); setSaving(false); return; }
        if (password !== confirmPassword) { setMessage("Passwords don't match."); setSaving(false); return; }
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { data: { first_name: firstName.trim(), last_name: lastName.trim(), full_name: `${firstName} ${lastName}`.trim() } },
        });
        if (error) throw error;
        if (data.session?.user) {
          await ensureProfileForUser(data.session.user).catch(console.error);
        }
        if (!data.session) {
          setMode("signin"); setMessage("Account created! Check your email then sign in."); setSaving(false); return;
        }
        router.push("/");
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;

        // Check ban status before allowing in
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_banned")
          .eq("id", data.user.id)
          .maybeSingle();

        if (profile?.is_banned) {
          await supabase.auth.signOut();
          setBanned(true);
          setSaving(false);
          return;
        }

        await ensureProfileForUser(data.user).catch(console.error);
        router.push("/");
      }
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Header />
      <div className="container containerPt48">
        <div className="loginWrapper">
          <div className="loginLogoWrap">
            <h1 className="loginHeading">
              {mode === "signup" ? "Create an account" : "Welcome back"}
            </h1>
          </div>

          {/* Banned message */}
          {banned && (
            <div style={{
              background: "#fef2f2",
              border: "1.5px solid #dc2626",
              borderRadius: "10px",
              padding: "16px 20px",
              marginBottom: "16px",
              textAlign: "center",
            }}>
              <p style={{ margin: "0 0 4px", fontWeight: 700, color: "#b91c1c", fontSize: "15px" }}>
                Account Suspended
              </p>
              <p style={{ margin: 0, fontSize: "13px", color: "#7f1d1d" }}>
                Your account has been suspended. Please contact support for assistance.
              </p>
            </div>
          )}

          <form className="formCard" onSubmit={handleSubmit}>
            {mode === "signup" && (
              <>
                <div className="field">
                  <label className="label">First Name</label>
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First Name" required />
                </div>
                <div className="field">
                  <label className="label">Last Name</label>
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last Name" required />
                </div>
              </>
            )}
            <div className="field">
              <label className="label">Email Address</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" required />
            </div>
            <div className="field">
              <label className="label">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
            </div>
            {mode === "signup" && (
              <div className="field">
                <label className="label">Re-Enter Password</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm Password" required />
              </div>
            )}

            <button type="submit" className="btn btnPrimary loginSubmitBtn" disabled={saving}>
              {saving ? (mode === "signup" ? "Creating..." : "Signing in...") : (mode === "signup" ? "Sign up" : "Login")}
            </button>

            {message && (
              <p className={`messageText ${message.includes("fail") || message.includes("match") || message.includes("required") ? "errorText" : "successText"}`}>
                {message}
              </p>
            )}
          </form>

          <p className="loginToggleWrap">
            {mode === "signup" ? "Already have an account? " : "Don't have an account? "}
            <button
              onClick={() => { setMode(mode === "signup" ? "signin" : "signup"); setMessage(""); setBanned(false); }}
              className="loginToggleBtn"
            >
              {mode === "signup" ? "Sign in" : "Sign up"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
