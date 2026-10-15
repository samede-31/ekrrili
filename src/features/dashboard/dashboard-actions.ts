"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const profileInput = z.object({
  fullName: z.string().trim().min(2).max(100),
  phoneNumber: z.string().trim().max(24).optional().default("").refine(
    (value) => !value || /^\+?[0-9\s().-]{8,24}$/.test(value),
    "Enter a valid phone number.",
  ),
  wilaya: z.string().trim().max(80).optional().default(""),
});

const listingInput = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(5).max(100),
  description: z.string().trim().min(20).max(3000),
  pricePerDay: z.coerce.number().finite().min(0).max(100_000_000),
});

const uuidInput = z.string().uuid();
const calendarDate = z.string().date();

async function getAuthenticatedClient() {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { supabase: null, user: null, error: "يرجى تسجيل الدخول للمتابعة." };
  return { supabase, user, error: null };
}

export async function updateDashboardProfile(formData: FormData) {
  const parsed = profileInput.safeParse({
    fullName: formData.get("fullName"),
    phoneNumber: formData.get("phoneNumber"),
    wilaya: formData.get("wilaya"),
  });
  if (!parsed.success) return { error: "تحقق من الاسم ورقم الهاتف والولاية." };

  const { supabase, user, error } = await getAuthenticatedClient();
  if (error || !supabase || !user) return { error: error ?? "يرجى تسجيل الدخول." };

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      phone_number: parsed.data.phoneNumber || null,
      wilaya: parsed.data.wilaya || null,
    })
    .eq("id", user.id);
  if (updateError) return { error: updateError.message };

  revalidatePath("/dashboard");
  return { success: "تم تحديث بيانات الملف الشخصي." };
}

export async function updateOwnedListing(formData: FormData) {
  const parsed = listingInput.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    description: formData.get("description"),
    pricePerDay: formData.get("pricePerDay"),
  });
  if (!parsed.success) return { error: "تحقق من عنوان الإعلان والوصف والسعر." };

  const { supabase, user, error } = await getAuthenticatedClient();
  if (error || !supabase || !user) return { error: error ?? "يرجى تسجيل الدخول." };

  const { data, error: updateError } = await supabase
    .from("listings")
    .update({
      title: parsed.data.title,
      description: parsed.data.description,
      price_per_day: parsed.data.pricePerDay,
    })
    .eq("id", parsed.data.id)
    .eq("owner_id", user.id)
    .select("id")
    .maybeSingle();
  if (updateError) return { error: updateError.message };
  if (!data) return { error: "لم يتم العثور على الإعلان أو لا تملك صلاحية تعديله." };

  revalidatePath("/dashboard");
  revalidatePath("/");
  return { success: "تم حفظ التعديلات." };
}

export async function setOwnedListingStatus(listingId: string, status: "active" | "paused") {
  if (!uuidInput.safeParse(listingId).success) return { error: "معرّف الإعلان غير صالح." };
  const { supabase, user, error } = await getAuthenticatedClient();
  if (error || !supabase || !user) return { error: error ?? "يرجى تسجيل الدخول." };
  const { data: listing, error: lookupError } = await supabase
    .from("listings")
    .select("status")
    .eq("id", listingId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (lookupError) return { error: lookupError.message };
  if (!listing) return { error: "لم يتم العثور على الإعلان أو لا تملك صلاحية تعديله." };
  if (listing.status === "rented") return { error: "لا يمكن تغيير حالة إعلان مرتبط بإيجار جارٍ." };

  const { data, error: updateError } = await supabase
    .from("listings")
    .update({ status })
    .eq("id", listingId)
    .eq("owner_id", user.id)
    .select("id")
    .maybeSingle();
  if (updateError) return { error: updateError.message };
  if (!data) return { error: "لم يتم العثور على الإعلان أو لا تملك صلاحية تعديله." };

  revalidatePath("/dashboard");
  revalidatePath("/");
  return { success: status === "active" ? "تم تفعيل الإعلان." : "تم إيقاف الإعلان مؤقتاً." };
}

export async function deleteOwnedListing(listingId: string) {
  if (!uuidInput.safeParse(listingId).success) return { error: "معرّف الإعلان غير صالح." };
  const { supabase, user, error } = await getAuthenticatedClient();
  if (error || !supabase || !user) return { error: error ?? "يرجى تسجيل الدخول." };
  const { count, error: requestLookupError } = await supabase
    .from("rental_requests")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId);
  if (requestLookupError) return { error: requestLookupError.message };
  if (count) return { error: "لا يمكن حذف إعلان له طلبات كراء محفوظة. أوقفه مؤقتاً بدلاً من ذلك." };

  const { data, error: deleteError } = await supabase
    .from("listings")
    .delete()
    .eq("id", listingId)
    .eq("owner_id", user.id)
    .select("id")
    .maybeSingle();
  if (deleteError) return { error: deleteError.message };
  if (!data) return { error: "لم يتم العثور على الإعلان أو لا تملك صلاحية حذفه." };

  revalidatePath("/dashboard");
  revalidatePath("/");
  return { success: "تم حذف الإعلان." };
}

export async function submitPlatformSubscriptionPayment(formData: FormData): Promise<{ success?: string; error?: string }> {
  const targetType = String(formData.get("targetType") ?? "");
  const currency = String(formData.get("currency") ?? "");
  const paymentMethod = String(formData.get("paymentMethod") ?? "");
  const planId = String(formData.get("planId") ?? "");
  const durationDays = Number(formData.get("durationDays"));
  const amount = Number(formData.get("amount"));
  const paymentReference = String(formData.get("paymentReference") ?? "").trim();
  const senderInfo = String(formData.get("senderInfo") ?? "").trim();
  const receipt = formData.get("receipt");
  const listingId = String(formData.get("listingId") ?? "");

  if (!["featured", "pro_store"].includes(targetType) ||
      !["DZD", "USD"].includes(currency) ||
      !["plan_7d", "plan_15d", "plan_30d"].includes(planId) ||
      ![7, 15, 30].includes(durationDays) ||
      !Number.isFinite(amount) || amount <= 0 ||
      (currency === "DZD" ? !["baridimob", "ccp"].includes(paymentMethod) : paymentMethod !== "bybit") ||
      paymentReference.length < 4 || paymentReference.length > 100 ||
      senderInfo.length < 2 || senderInfo.length > 120 ||
      (targetType === "featured" && !uuidInput.safeParse(listingId).success)) {
    return { error: "بيانات خطة الدفع أو التحويل غير صالحة." };
  }

  if (receipt !== null && (!(receipt instanceof File) || receipt.size > 8 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(receipt.type))) {
    return { error: "الإيصال يجب أن يكون صورة JPG أو PNG أو WebP بحد أقصى 8 ميغابايت." };
  }
  if (currency === "DZD" && (!(receipt instanceof File) || receipt.size === 0)) {
    return { error: "أرفق صورة إيصال BaridiMob أو CCP." };
  }

  const { supabase, user, error } = await getAuthenticatedClient();
  if (error || !supabase || !user) return { error: error ?? "يرجى تسجيل الدخول." };
  const { data: profile, error: profileError } = await supabase
    .from("profiles").select("is_suspended").eq("id", user.id).maybeSingle();
  if (profileError) return { error: profileError.message };
  if (!profile || profile.is_suspended) return { error: "الحساب غير متاح لإرسال طلب اشتراك." };

  let receiptPath: string | null = null;
  if (receipt instanceof File && receipt.size > 0) {
    const extension = receipt.type === "image/jpeg" ? "jpg" : receipt.type === "image/png" ? "png" : "webp";
    receiptPath = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const bucket = targetType === "featured" ? "listing-promotion-receipts" : "pro-store-receipts";
    const { error: uploadError } = await supabase.storage.from(bucket).upload(receiptPath, receipt, {
      contentType: receipt.type,
      upsert: false,
    });
    if (uploadError) return { error: `تعذر رفع إيصال الدفع: ${uploadError.message}` };
  }

  try {
    const { error: rpcError } = targetType === "featured"
      ? await supabase.rpc("submit_listing_promotion", {
        requested_listing_id: listingId,
        requested_receipt_path: receiptPath,
        requested_plan_id: planId,
        requested_duration_days: durationDays,
        requested_currency: currency,
        requested_amount: amount,
        requested_payment_method: paymentMethod,
        requested_payment_reference: paymentReference,
        requested_sender_info: senderInfo,
      })
      : await supabase.rpc("submit_pro_store_application", {
        requested_store_name: String(formData.get("storeName") ?? "").trim(),
        requested_store_slug: String(formData.get("storeSlug") ?? "").trim().toLowerCase(),
        requested_store_bio: String(formData.get("storeBio") ?? "").trim(),
        requested_business_hours: {},
        requested_wilaya: String(formData.get("storeWilaya") ?? "").trim(),
        requested_map_location: "",
        requested_receipt_path: receiptPath,
        requested_payment_reference: paymentReference,
        requested_sender_info: senderInfo,
        requested_plan_id: planId,
        requested_currency: currency,
        requested_amount: amount,
        requested_payment_method: paymentMethod,
      });
    if (rpcError) throw new Error(rpcError.message);
    revalidatePath("/dashboard");
    revalidatePath("/admin");
    return { success: "تم إرسال طلب الدفع إلى الإدارة للمراجعة." };
  } catch (caught) {
    if (receiptPath) {
      const bucket = targetType === "featured" ? "listing-promotion-receipts" : "pro-store-receipts";
      const { error: cleanupError } = await supabase.storage.from(bucket).remove([receiptPath]);
      if (cleanupError) {
        return { error: `${caught instanceof Error ? caught.message : "تعذر إرسال الطلب."} كما تعذر حذف الإيصال المؤقت: ${cleanupError.message}` };
      }
    }
    return { error: caught instanceof Error ? caught.message : "تعذر إرسال طلب الدفع." };
  }
}

export async function redeemFeaturedPromoCode(
  listingId: string,
  code: string,
): Promise<{ success?: string; error?: string }> {
  if (!uuidInput.safeParse(listingId).success || !/^[A-Z0-9_-]{3,32}$/i.test(code.trim())) {
    return { error: "الإعلان أو الرمز الترويجي غير صالح." };
  }
  const { supabase, user, error } = await getAuthenticatedClient();
  if (error || !supabase || !user) return { error: error ?? "يرجى تسجيل الدخول." };

  const { error: redemptionError } = await supabase.rpc("redeem_featured_promo_code", {
    requested_listing_id: listingId,
    requested_code: code.trim().toUpperCase(),
  });
  if (redemptionError) return { error: redemptionError.message };
  revalidatePath("/dashboard");
  revalidatePath("/");
  revalidatePath(`/listings/${listingId}`);
  return { success: "تم تفعيل التمييز المجاني باستخدام الرمز الترويجي." };
}

export async function setRentalRequestStatus(requestId: string, status: "approved" | "cancelled") {
  void requestId;
  void status;
  return { error: "إدارة الكراء تتم مباشرة بين المستخدمين؛ اكريلي لا تسجل أو تدير الطلبات." };
  /*
  if (!uuidInput.safeParse(requestId).success) return { error: "معرّف الطلب غير صالح." };
  const { supabase, user, error } = await getAuthenticatedClient();
  if (error || !supabase || !user) return { error: error ?? "يرجى تسجيل الدخول." };

  let mutation = supabase.from("rental_requests").update({ status }).eq("id", requestId);
  mutation = status === "approved"
    ? mutation.eq("status", "pending")
    : mutation.in("status", ["pending", "approved"]);
  const { data, error: updateError } = await mutation.select("id").maybeSingle();
  if (updateError) return { error: updateError.message };
  if (!data) {
    return { error: "لا يمكن تحديث هذا الطلب أو لا تملك صلاحية تعديله." };
  }
  revalidatePath("/dashboard");
  return { success: status === "approved" ? "تم قبول طلب الكراء." : "تم رفض أو إلغاء الطلب." };
  */
}

export async function setRentalCompleted(requestId: string) {
    void requestId;
    return { error: "إدارة الكراء تتم مباشرة بين المستخدمين؛ اكريلي لا تسجل أو تدير الطلبات." };
    /*
    if (!uuidInput.safeParse(requestId).success) return { error: "معرّف الطلب غير صالح." };
    const { supabase, user, error } = await getAuthenticatedClient();
    if (error || !supabase || !user) return { error: error ?? "يرجى تسجيل الدخول." };
    const { data, error: updateError } = await supabase
      .from("rental_requests")
      .update({ status: "completed" })
      .eq("id", requestId)
      .eq("status", "active")
      .select("id")
      .maybeSingle();
    if (updateError) return { error: updateError.message };
    if (!data) return { error: "لا يمكن إكمال هذا الكراء أو لا تملك صلاحية تعديله." };
    revalidatePath("/dashboard");
    return { success: "تم إكمال الكراء. يمكن للطرفين الآن توثيق التجربة وكتابة تقييم." };
    */
  }

export async function setListingBlackoutDate(listingId: string, date: string, blocked: boolean) {
    void listingId;
    void date;
    void blocked;
    return { error: "تحققوا من الإتاحة والتواريخ مباشرة بين المستخدمين." };
    /*
    if (!uuidInput.safeParse(listingId).success || !calendarDate.safeParse(date).success) {
      return { error: "الإعلان أو التاريخ غير صالح." };
    }
    const { supabase, user, error } = await getAuthenticatedClient();
    if (error || !supabase || !user) return { error: error ?? "يرجى تسجيل الدخول." };

    if (blocked) {
      const { count, error: bookingError } = await supabase
        .from("rental_requests")
        .select("id", { count: "exact", head: true })
        .eq("listing_id", listingId)
        .in("status", ["approved", "active"])
        .lte("start_date", date)
        .gt("end_date", date);
      if (bookingError) return { error: bookingError.message };
      if (count) return { error: "لا يمكن حظر تاريخ مرتبط بحجز مؤكد أو جارٍ." };

      const { data, error: insertError } = await supabase
        .from("listing_blackout_dates")
        .insert({ listing_id: listingId, owner_id: user.id, blocked_date: date })
        .select("id")
        .maybeSingle();
      if (insertError) return { error: insertError.message };
      if (!data) return { error: "لم يتم حفظ تاريخ الحظر." };
    } else {
      const { error: deleteError } = await supabase
        .from("listing_blackout_dates")
        .delete()
        .eq("listing_id", listingId)
        .eq("owner_id", user.id)
        .eq("blocked_date", date);
      if (deleteError) return { error: deleteError.message };
    }

    revalidatePath("/dashboard");
    revalidatePath(`/listings/${listingId}`);
    revalidatePath("/");
    return { success: blocked ? "تم حظر التاريخ." : "تم إلغاء حظر التاريخ." };
    */
  }

export async function submitHandoverLog(formData: FormData) {
    void formData;
    return { error: "تسليم الأغراض يتم مباشرة بين المستخدمين وخارج اكريلي." };
    /*
    const requestId = String(formData.get("requestId") ?? "");
    const phase = String(formData.get("phase") ?? "");
    const notes = String(formData.get("notes") ?? "").trim();
    const file = formData.get("photo");
    if (!uuidInput.safeParse(requestId).success || !["check_in", "check_out"].includes(phase)) {
      return { error: "بيانات توثيق التسليم غير صالحة." };
    }
    if (notes.length < 3 || notes.length > 2000) return { error: "اكتب وصفاً للحالة بين 3 و2000 حرف." };
    if (file !== null && (!(file instanceof File) || (file.size > 0 && (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024)))) {
      return { error: "الصورة اختيارية، ويجب أن تكون صورة بحجم لا يتجاوز 8 ميغابايت." };
    }

    const { supabase, user, error } = await getAuthenticatedClient();
    if (error || !supabase || !user) return { error: error ?? "يرجى تسجيل الدخول." };
    const { data: request, error: requestError } = await supabase
      .from("rental_requests")
      .select("id")
      .eq("id", requestId)
      .maybeSingle();
    if (requestError) return { error: requestError.message };
    if (!request) return { error: "الطلب غير موجود أو لا تملك صلاحية الوصول إليه." };

    let photoPath: string | null = null;
    if (file instanceof File && file.size > 0) {
      const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      photoPath = `${user.id}/${requestId}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("rental-handover-photos")
        .upload(photoPath, new Uint8Array(await file.arrayBuffer()), { contentType: file.type, upsert: false });
      if (uploadError) return { error: `تعذر رفع صورة الحالة: ${uploadError.message}` };
    }

    const { data, error: insertError } = await supabase
      .from("rental_handover_logs")
      .insert({
        rental_request_id: requestId,
        user_id: user.id,
        phase,
        condition_notes: notes,
        photo_paths: photoPath ? [photoPath] : [],
      })
      .select("id")
      .maybeSingle();
    if (insertError || !data) {
      if (photoPath) {
        const { error: cleanupError } = await supabase.storage.from("rental-handover-photos").remove([photoPath]);
        if (cleanupError) return { error: `تعذر حفظ سجل التسليم (${insertError?.message ?? "خطأ غير معروف"})، كما تعذر حذف الصورة المرفوعة (${cleanupError.message}).` };
      }
      return { error: insertError?.message ?? "تعذر حفظ سجل التسليم." };
    }
    revalidatePath("/dashboard");
    return { success: "تم حفظ سجل توثيق الحالة للطرفين." };
    */
  }

export async function submitRentalReview(requestId: string, rating: number, comment: string) {
    void requestId;
    void rating;
    void comment;
    return { error: "اكريلي لا تدير عمليات الكراء؛ يمكن للمستخدمين التواصل مباشرة." };
    /*
    if (!uuidInput.safeParse(requestId).success || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return { error: "اختر تقييماً من نجمة إلى خمس نجوم." };
    }
    const cleanComment = comment.trim();
    if (cleanComment.length < 3 || cleanComment.length > 1000) return { error: "اكتب تعليقاً بين 3 و1000 حرف." };

    const { supabase, user, error } = await getAuthenticatedClient();
    if (error || !supabase || !user) return { error: error ?? "يرجى تسجيل الدخول." };
    const { data: request, error: requestError } = await supabase
      .from("rental_requests")
      .select("renter_id, listing_id, status")
      .eq("id", requestId)
      .eq("status", "completed")
      .maybeSingle();
    if (requestError) return { error: requestError.message };
    if (!request) return { error: "يمكن تقييم الكراء المكتمل فقط." };
    const { data: listing, error: listingError } = await supabase
      .from("listings")
      .select("owner_id")
      .eq("id", request.listing_id)
      .maybeSingle();
    if (listingError) return { error: listingError.message };
    if (!listing || ![request.renter_id, listing.owner_id].includes(user.id)) {
      return { error: "التقييم متاح لطرفي الكراء فقط." };
    }
    const revieweeId = user.id === request.renter_id ? listing.owner_id : request.renter_id;
    const { error: insertError } = await supabase.from("reviews").insert({
      rental_request_id: requestId,
      reviewer_id: user.id,
      reviewee_id: revieweeId,
      rating,
      comment: cleanComment,
    });
    if (insertError) return { error: insertError.code === "23505" ? "سبق أن أرسلت تقييماً لهذا الكراء." : insertError.message };
    revalidatePath("/dashboard");
    revalidatePath("/");
    return { success: "تم إرسال تقييمك وتحديث متوسط تقييم المستخدم." };
    */
  }

export async function markNotificationsRead(notificationIds: string[]) {
    if (notificationIds.length < 1 || notificationIds.length > 50 || notificationIds.some((id) => !uuidInput.safeParse(id).success)) {
      return { error: "قائمة الإشعارات غير صالحة." };
    }
    const { supabase, user, error } = await getAuthenticatedClient();
    if (error || !supabase || !user) return { error: error ?? "يرجى تسجيل الدخول." };
    const { error: updateError } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .in("id", notificationIds)
      .eq("user_id", user.id)
      .is("read_at", null);
    if (updateError) return { error: updateError.message };
    revalidatePath("/");
    revalidatePath("/dashboard");
    return { success: "تم تحديث الإشعارات." };
  }

export async function submitIdentityDocument(formData: FormData) {
  const file = formData.get("identityDocument");
  if (!(file instanceof File) || file.size === 0) return { error: "اختر صورة أو ملف PDF لبطاقة التعريف." };
  if (file.size > 8 * 1024 * 1024) return { error: "يجب ألا يتجاوز حجم الملف 8 ميغابايت." };
  if (!["image/jpeg", "image/png", "application/pdf"].includes(file.type)) {
    return { error: "الصيغ المقبولة: JPG أو PNG أو PDF." };
  }

  const { supabase, user, error } = await getAuthenticatedClient();
  if (error || !supabase || !user) return { error: error ?? "يرجى تسجيل الدخول." };

  const extension = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
  const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
  const { error: uploadError } = await supabase.storage
    .from("ekrrili-identity-documents")
    .upload(path, new Uint8Array(await file.arrayBuffer()), {
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) return { error: uploadError.message };

  const { error: recordError } = await supabase.from("identity_documents").insert({
    user_id: user.id,
    storage_path: path,
  });
  if (recordError) {
    const { error: cleanupError } = await supabase.storage
      .from("ekrrili-identity-documents")
      .remove([path]);
    return {
      error: cleanupError
        ? `تعذر تسجيل طلب التحقق (${recordError.message}) وتعذر حذف الملف المرفوع (${cleanupError.message}).`
        : `تعذر تسجيل طلب التحقق: ${recordError.message}`,
    };
  }

  revalidatePath("/dashboard");
  return { success: "تم استلام الوثيقة بشكل خاص. ستبقى شارة التوثيق معلّقة إلى حين المراجعة." };
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError) throw new Error(signOutError.message);
  revalidatePath("/", "layout");
  redirect("/login");
}
