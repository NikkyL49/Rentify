// Legacy /admin redirect → /dashboard
// Keeps old links working while the real admin lives at /dashboard
import { redirect } from "next/navigation";
export default function AdminRedirect() {
  redirect("/dashboard");
}
