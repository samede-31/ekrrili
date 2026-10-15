"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PromotionPaymentSettings } from "@/features/promotions/promotion-settings";

type ActionResult = { success?: string; error?: string };

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("يجب تسجيل الدخول بحساب إداري.");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, is_suspended")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error(`تعذر التحقق من صلاحيات الإدارة: ${error.message}`);
  if (!profile || profile.role !== "admin" || profile.is_suspended) {
    throw new Error("ليس لديك صلاحية تنفيذ إجراءات الإدارة.");
  }
  return { supabase, userId: user.id };
}

async function runAdminAction(action: (context: Awaited<ReturnType<typeof requireAdmin>>) => Promise<string>): Promise<ActionResult> {
  try {
    const context = await requireAdmin();
    const success = await action(context);
    revalidatePath("/admin");
    return { success };
  } catch (caught) {
    return { error: caught instanceof Error ? caught.message : "تعذر تنفيذ الإجراء الإداري." };
  }
}

export async function reviewIdentityDocument(
  documentId: string,
  decision: "approved" | "rejected",
  note = "",
): Promise<ActionResult> {
  if (!documentId || (decision !== "approved" && decision !== "rejected")) {
    return { error: "بيانات مراجعة الهوية غير صالحة." };
  }
  if (decision === "rejected" && !note.trim()) return { error: "اكتب سبب رفض الطلب." };

  return runAdminAction(async ({ supabase }) => {
    const { error } = await supabase.rpc("admin_review_identity_document", {
      document_id: documentId,
      decision,
      note: note.trim(),
    });
    if (error) throw new Error(`تعذرت مراجعة وثيقة الهوية: ${error.message}`);
    return decision === "approved" ? "تم توثيق الهوية ومنح الشارة." : "تم رفض طلب التوثيق.";
  });
}

export async function setAdminUserFlag(
  profileId: string,
  flag: "identity_verified" | "is_suspended",
  value: boolean,
): Promise<ActionResult> {
  if (!profileId || typeof value !== "boolean") return { error: "بيانات المستخدم غير صالحة." };

  return runAdminAction(async ({ supabase, userId }) => {
    if (flag === "is_suspended" && profileId === userId && value) {
      throw new Error("لا يمكنك إيقاف حسابك الإداري الحالي.");
    }
    const { error } = await supabase.from("profiles").update({ [flag]: value }).eq("id", profileId);
    if (error) throw new Error(`تعذر تحديث المستخدم: ${error.message}`);
    return "تم تحديث إعدادات المستخدم.";
  });
}

export async function moderateListing(
  listingId: string,
  action: "feature" | "unfeature" | "pause" | "activate" | "delete",
): Promise<ActionResult> {
  if (!listingId) return { error: "لم يتم تحديد الإعلان." };

  return runAdminAction(async ({ supabase }) => {
    if (action === "delete") {
      const { error } = await supabase.from("listings").delete().eq("id", listingId);
      if (error) throw new Error(`تعذر حذف الإعلان: ${error.message}`);
      return "تم حذف الإعلان.";
    }

    const update = action === "feature" || action === "unfeature"
      ? {
        is_featured: action === "feature",
        featured_until: action === "feature" ? new Date(Date.now() + 30 * 86_400_000).toISOString() : null,
        featured_expiration_notified_at: null,
      }
      : { status: action === "pause" ? "paused" : "active" };
    const { error } = await supabase.from("listings").update(update).eq("id", listingId);
    if (error) throw new Error(`تعذر تحديث الإعلان: ${error.message}`);
    return "تم تحديث الإعلان.";
  });
}

export async function reviewListingPromotion(
  promotionId: string,
  decision: "approved" | "rejected",
  note = "",
): Promise<ActionResult> {
  if (!/^[0-9a-f-]{36}$/i.test(promotionId) || !["approved", "rejected"].includes(decision) || note.length > 1000) {
    return { error: "بيانات مراجعة طلب التمييز غير صالحة." };
  }
  if (decision === "rejected" && note.trim().length < 3) return { error: "اكتب سبب رفض طلب الدفع." };
  return runAdminAction(async ({ supabase }) => {
    const { error } = await supabase.rpc("review_listing_promotion", {
      promotion_id: promotionId,
      decision,
      note: note.trim() || null,
    });
    if (error) throw new Error(`تعذرت مراجعة طلب التمييز: ${error.message}`);
    revalidatePath("/");
    revalidatePath("/dashboard");
    return decision === "approved" ? "تم تأكيد الدفع وتفعيل التمييز." : "تم رفض طلب التمييز.";
  });
}

export async function saveAdminPromotionSettings(settings: PromotionPaymentSettings): Promise<ActionResult> {
  const officialPlans = [
    ["plan_7d", 7, "باقة 7 أيام - أسبوع"],
    ["plan_15d", 15, "خطة 15 يوم"],
    ["plan_30d", 30, "خطة 30 يوم - شهر كامل"],
  ] as const;
  if (!settings || !Array.isArray(settings.promotion_plans) || settings.promotion_plans.length !== officialPlans.length ||
      officialPlans.some(([id]) => !settings.promotion_plans.some((plan) => plan.id === id)) ||
      !settings.promotion_plans.some((plan) => plan.enabled) ||
      !Array.isArray(settings.promo_codes) || settings.promo_codes.length > 100) {
    return { error: "يجب إعداد الباقات الثلاثة ورموز الترويج بصيغة صحيحة." };
  }
  if (settings.promotion_plans.some((plan) => {
    const official = officialPlans.find(([id]) => plan.id === id);
    return !official || plan.duration_days !== official[1] || plan.name !== official[2] ||
    !Number.isInteger(plan.amount_dzd) || plan.amount_dzd < 1 ||
    !Number.isFinite(plan.amount_usd) || plan.amount_usd <= 0;
  }) ||
    settings.promo_codes.some((promo) =>
      !/^[A-Z0-9_-]{3,32}$/.test(promo.code) ||
      ![7, 14].includes(promo.duration_days) ||
      typeof promo.active !== "boolean" ||
      (promo.max_uses !== null && (!Number.isInteger(promo.max_uses) || promo.max_uses < 1)) ||
      !Number.isInteger(promo.redeemed_count) || promo.redeemed_count < 0 ||
      (promo.redeemed_by !== undefined && !Array.isArray(promo.redeemed_by))) ||
    new Set(settings.promo_codes.map((promo) => promo.code.toUpperCase())).size !== settings.promo_codes.length) {
    return { error: "تحقق من أسماء الباقات وأسعارها ومددها." };
  }
  return runAdminAction(async ({ supabase, userId }) => {
    const { error } = await supabase.from("platform_settings").upsert({
      id: "promotion_payments",
      ccp_account_number: settings.ccp_account_number,
      ccp_key: settings.ccp_key,
      baridimob_rip: settings.baridimob_rip,
      account_holder_name: settings.account_holder_name,
      support_phone: settings.support_phone,
      bybit_uid: settings.bybit_uid,
      bybit_pay_qr_url: settings.bybit_pay_qr_url,
      usdt_wallet_address: settings.usdt_wallet_address,
      promotion_plans: settings.promotion_plans,
      promo_codes: settings.promo_codes,
      updated_by: userId,
    }, { onConflict: "id" });
    if (error) throw new Error(`تعذر حفظ إعدادات الدفع: ${error.message}`);
    return "تم حفظ إعدادات الدفع والباقات.";
  });
}

export async function reviewDisputeReport(
  reportId: string,
  decision: "reviewing" | "resolved" | "dismissed",
  adminNote = "",
): Promise<ActionResult> {
  if (!/^[0-9a-f-]{36}$/i.test(reportId) || !["reviewing", "resolved", "dismissed"].includes(decision) || adminNote.length > 2000) {
    return { error: "بيانات مراجعة البلاغ غير صالحة." };
  }
  return runAdminAction(async ({ supabase }) => {
    const { error } = await supabase.from("dispute_reports").update({
      status: decision,
      admin_note: adminNote.trim() || null,
      reviewed_at: new Date().toISOString(),
    }).eq("id", reportId);
    if (error) throw new Error(`تعذرت مراجعة البلاغ: ${error.message}`);
    revalidatePath("/admin");
    return "تم تحديث حالة البلاغ.";
  });
}

export async function reviewProStoreApplication(
  applicationId: string,
  decision: "approved" | "rejected",
  note = "",
): Promise<ActionResult> {
  if (!/^[0-9a-f-]{36}$/i.test(applicationId) || !["approved", "rejected"].includes(decision) || note.length > 1000) {
    return { error: "بيانات مراجعة متجر PRO غير صالحة." };
  }
  return runAdminAction(async ({ supabase }) => {
    const { error } = await supabase.rpc("review_pro_store_application", {
      application_id: applicationId,
      decision,
      rejection_message: note.trim() || null,
    });
    if (error) throw new Error(`تعذرت مراجعة طلب المتجر: ${error.message}`);
    revalidatePath("/stores");
    revalidatePath("/dashboard");
    return decision === "approved" ? "تم تأكيد الدفع وتفعيل متجر PRO." : "تم رفض طلب متجر PRO.";
  });
}

export async function setAdminProStoreExpiry(profileId: string, expiresOn: string): Promise<ActionResult> {
  if (!/^[0-9a-f-]{36}$/i.test(profileId) || !/^\d{4}-\d{2}-\d{2}$/.test(expiresOn) ||
      Number.isNaN(Date.parse(`${expiresOn}T23:59:59.999Z`)) ||
      Date.parse(`${expiresOn}T23:59:59.999Z`) <= Date.now()) {
    return { error: "معرّف المتجر أو تاريخ الانتهاء غير صالح." };
  }
  return runAdminAction(async ({ supabase }) => {
    const { error } = await supabase.from("profiles").update({
      is_pro_store: true,
      pro_until: new Date(`${expiresOn}T23:59:59.999Z`).toISOString(),
    }).eq("id", profileId);
    if (error) throw new Error(`تعذر تحديث اشتراك المتجر: ${error.message}`);
    revalidatePath("/stores");
    return "تم تحديث تاريخ انتهاء متجر PRO.";
  });
}

export async function updateAdminCategory(
  categoryId: string,
  nameAr: string,
  nameFr: string,
  dynamicSchemaText: string,
): Promise<ActionResult> {
  if (!categoryId || !nameAr.trim() || !nameFr.trim()) return { error: "أدخل اسمي التصنيف بالعربية والفرنسية." };

  let dynamicSchema: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(dynamicSchemaText);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { error: "يجب أن تكون الحقول الديناميكية كائن JSON." };
    }
    dynamicSchema = parsed as Record<string, unknown>;
  } catch {
    return { error: "صيغة JSON للحقول الديناميكية غير صالحة." };
  }

  return runAdminAction(async ({ supabase }) => {
    const { error } = await supabase
      .from("categories")
      .update({ name_ar: nameAr.trim(), name_fr: nameFr.trim(), dynamic_schema: dynamicSchema })
      .eq("id", categoryId);
    if (error) throw new Error(`تعذر حفظ التصنيف: ${error.message}`);
    return "تم حفظ التصنيف.";
  });
}
