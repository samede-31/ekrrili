import type { Metadata } from "next";
import { SupportContent } from "@/features/legal/support-content";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "المساعدة والدعم",
  description: "الأسئلة الشائعة والتواصل مع دعم اكريلي عبر واتساب.",
};

export default async function SupportPage() {
  if (!getSupabasePublicConfig()) return <SupportContent initialPhone="" />;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from("platform_settings")
    .select("support_phone")
    .eq("id", "promotion_payments")
    .maybeSingle();
  if (error) {
    return <main dir="rtl" lang="ar" className="min-h-[70vh] p-8"><p role="alert" className="text-red-800">تعذر تحميل بيانات الدعم: {error.message}</p></main>;
  }
  return <SupportContent initialPhone={data?.support_phone ?? ""} />;
}
