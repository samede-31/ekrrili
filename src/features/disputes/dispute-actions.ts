"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const reportSchema = z.object({
  listingId: z.string().uuid().optional(),
  requestId: z.string().uuid().optional(),
  targetUserId: z.string().uuid().optional(),
  reason: z.enum(["damage", "late_return", "no_show", "fraud", "other"]),
  details: z.string().trim().min(10).max(3000),
}).refine((value) => value.listingId || value.requestId);

export async function submitDisputeReport(input: z.input<typeof reportSchema>) {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { error: "تحقق من نوع البلاغ واكتب تفاصيل لا تقل عن 10 أحرف." };
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) return { error: authError.message };
  if (!user) return { loginRequired: true as const };
  const { error } = await supabase.from("dispute_reports").insert({
    reporter_id: user.id,
    target_user_id: parsed.data.targetUserId ?? null,
    listing_id: parsed.data.listingId ?? null,
    rental_request_id: parsed.data.requestId ?? null,
    reason: parsed.data.reason,
    details: parsed.data.details,
  });
  if (error) return { error: `تعذر إرسال البلاغ: ${error.message}` };
  return { success: "تم إرسال البلاغ إلى الإدارة للمراجعة." };
}
