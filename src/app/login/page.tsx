import { redirect } from "next/navigation";
import { SupabaseSetupNotice } from "@/components/supabase-setup-notice";
import { AuthForm } from "@/features/auth/auth-form";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (!getSupabasePublicConfig()) return <SupabaseSetupNotice />;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");
  return <AuthForm mode="login" />;
}
