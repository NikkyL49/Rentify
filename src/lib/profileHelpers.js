import { supabase } from "@/lib/supabaseClient";

export function fullNameFromProfile(profile) {
  if (!profile) return "";

  const firstName =
    typeof profile.first_name === "string" ? profile.first_name.trim() : "";
  const lastName =
    typeof profile.last_name === "string" ? profile.last_name.trim() : "";

  return `${firstName} ${lastName}`.trim();
}

export function ownerNameFromUser(user, profile = null) {
  const fromProfile = fullNameFromProfile(profile);
  if (fromProfile) return fromProfile;

  const meta = user?.user_metadata ?? {};
  const fromMeta =
    `${meta.first_name ?? ""} ${meta.last_name ?? ""}`.trim() ||
    (typeof meta.full_name === "string" ? meta.full_name.trim() : "");

  return fromMeta || user?.email || "Unknown user";
}

export function userLabel(profile, fallbackEmail = "", fallbackId = "") {
  if (profile?.email && String(profile.email).includes("@")) {
    return String(profile.email).trim().toLowerCase();
  }

  if (fallbackEmail && String(fallbackEmail).includes("@")) {
    return String(fallbackEmail).trim().toLowerCase();
  }

  return fallbackId || "Unknown user";
}

export async function ensureProfileForUser(user) {
  if (!user) return { data: null, error: null };

  const meta = user.user_metadata ?? {};
  const firstName =
    typeof meta.first_name === "string" ? meta.first_name.trim() : "";
  const lastName =
    typeof meta.last_name === "string" ? meta.last_name.trim() : "";

  return supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: user.email ?? "",
        first_name: firstName,
        last_name: lastName,
      },
      { onConflict: "id" }
    )
    .select()
    .single();
}

export async function loadProfiles() {
  return supabase
    .from("profiles")
    .select("*")
    .order("first_name", { ascending: true })
    .order("email", { ascending: true });
}
