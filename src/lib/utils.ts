// ─── Shared utilities ────────────────────────────────────────────────────────

/** Formats a number as USD currency. Returns null for 0 or non-finite values. */
export function fmtPrice(val: number | string | undefined | null, returnNull = false): string | null {
  const n = Number(val);
  if (!isFinite(n) || (n === 0 && returnNull)) return null;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

/** Formats a date string as "Mon D, YYYY". Returns "—" for falsy input. */
export function fmtDate(s: string | undefined | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** App-wide category definitions — single source of truth. */
export const CATEGORIES = [
  { id: "",        label: "All" },
  { id: "C-TXTBK", label: "Textbooks" },
  { id: "C-ELEC",  label: "Electronics" },
  { id: "C-LAB",   label: "Lab Equipment" },
] as const;

/** Categories without the "All" entry, for use in create/edit forms. */
export const FORM_CATEGORIES = CATEGORIES.filter((c) => c.id !== "");
