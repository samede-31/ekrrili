import { redirect } from "next/navigation";
import { AdminDashboard, type AdminDashboardData } from "@/features/admin/admin-dashboard";
import { categories as localCategories } from "@/features/listings/listing-options";
import { demoListings } from "@/features/listings/demo-listings";
import { LOCAL_OWNER_ID, LOCAL_RENTER_ID } from "@/features/listings/local-marketplace";
import { defaultPromotionPaymentSettings } from "@/features/promotions/promotion-settings";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function demoData(): AdminDashboardData {
  const demoProfiles = [
    { id: "demo-user-01", fullName: "ياسمين بن صالح", email: "yasmine@example.local", phone: "+213555010101", wilaya: "الجزائر", verified: true, suspended: false, role: "user" as const },
    { id: "demo-user-02", fullName: "مراد قادري", email: "mourad@example.local", phone: "+213555010202", wilaya: "الجزائر", verified: true, suspended: false, role: "user" as const },
    { id: "demo-user-03", fullName: "سفيان بوعلام", email: "sofiane@example.local", phone: "+213555010303", wilaya: "وهران", verified: false, suspended: false, role: "user" as const },
    { id: "demo-user-04", fullName: "ليلى عمار", email: "leila@example.local", phone: "+213555010404", wilaya: "قسنطينة", verified: false, suspended: true, role: "user" as const },
    { id: LOCAL_OWNER_ID, fullName: "صاحب الإعلان التجريبي", email: "owner@example.local", phone: "+213555000000", wilaya: "الجزائر", verified: false, suspended: false, role: "user" as const },
    { id: LOCAL_RENTER_ID, fullName: "المستأجر التجريبي", email: "renter@example.local", phone: "+213555000001", wilaya: "الجزائر", verified: false, suspended: false, role: "user" as const },
  ];
  return {
    demoMode: true,
    profiles: demoProfiles,
    documents: [
      { id: "demo-document-01", userId: "demo-user-03", fullName: "سفيان بوعلام", phone: "+213555010303", status: "pending", submittedAt: new Date().toISOString(), signedUrl: null, rejectionNote: null },
      { id: "demo-document-02", userId: "demo-user-04", fullName: "ليلى عمار", phone: "+213555010404", status: "pending", submittedAt: new Date(Date.now() - 86_400_000).toISOString(), signedUrl: null, rejectionNote: null },
    ],
    listings: demoListings.map((listing, index) => ({
      id: listing.id,
      title: listing.title.ar,
      ownerId: `demo-user-0${(index % 3) + 1}`,
      ownerName: listing.owner.ar,
      categoryName: localCategories.find((category) => category.id === listing.category)?.label.ar ?? "أخرى",
      price: listing.price,
      status: "active" as const,
      featured: Boolean(listing.badge),
      featuredUntil: listing.badge ? new Date(Date.now() + 30 * 86_400_000).toISOString() : null,
      image: listing.images[0] ?? null,
      createdAt: new Date(Date.now() - index * 86_400_000).toISOString(),
    })),
    rentals: [],
    categories: localCategories.map((category) => ({
      id: category.id,
      slug: category.id,
      nameAr: category.label.ar,
      nameFr: category.label.fr,
      dynamicSchema: { fields: category.fields },
    })),
    promotions: [],
    disputes: [],
    proStoreApplications: [],
    proStores: [],
    paymentSettings: structuredClone(defaultPromotionPaymentSettings),
  };
}

function LoadError({ message }: { message: string }) {
  return (
    <main dir="rtl" lang="ar" className="min-h-screen bg-[#f7f8f6] px-4 py-12">
      <section className="mx-auto max-w-2xl rounded-3xl border border-red-100 bg-white p-7">
        <h1 className="text-xl font-extrabold text-[#17231d]">تعذّر تحميل لوحة الإدارة</h1>
        <p role="alert" className="mt-3 text-sm leading-7 text-red-800">{message}</p>
        <p className="mt-2 text-xs leading-6 text-[#748078]">تحقق من تطبيق ترحيلات لوحة الإدارة وإعداد صلاحيات Supabase.</p>
      </section>
    </main>
  );
}

export default async function AdminPage() {
  if (!getSupabasePublicConfig()) {
    return <AdminDashboard initialData={demoData()} />;
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_suspended")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) return <LoadError message={profileError.message} />;
  if (!profile || profile.role !== "admin" || profile.is_suspended) redirect("/dashboard");

  const { error: expirationError } = await supabase.rpc("expire_featured_listings");
  if (expirationError) return <LoadError message={`تعذر تحديث الإعلانات المنتهية: ${expirationError.message}`} />;

  const { error: proExpirationError } = await supabase.rpc("expire_pro_stores");
  if (proExpirationError) return <LoadError message={`تعذر تحديث اشتراكات المتاجر المنتهية: ${proExpirationError.message}`} />;

  const [profileRows, documentRows, listingRows, categoryRows, disputeRows, promotionRows, proApplicationRows, settingsResult] = await Promise.all([
    supabase.from("profiles").select("id, full_name, phone_number, wilaya, identity_verified, is_suspended, role, created_at, is_pro_store, store_name, store_slug, pro_until").order("created_at", { ascending: false }),
    supabase.from("identity_documents").select("id, user_id, storage_path, status, submitted_at, rejection_note").order("submitted_at", { ascending: false }),
    supabase.from("listings").select("id, owner_id, title, price_per_day, status, is_featured, featured_until, images, created_at, categories(name_ar)").order("created_at", { ascending: false }),
    supabase.from("categories").select("id, slug, name_ar, name_fr, dynamic_schema").order("name_ar"),
    supabase.from("dispute_reports").select("id, reporter_id, target_user_id, listing_id, rental_request_id, reason, details, status, created_at").order("created_at", { ascending: false }),
    supabase.from("listing_promotions").select("id, listing_id, owner_id, receipt_path, receipt_image_url, status, submitted_at, rejection_note, plan_id, duration_days, amount_dzd, amount_usd, currency, payment_method, payment_reference, sender_info").order("submitted_at", { ascending: false }),
    supabase.from("pro_store_applications").select("id, owner_id, store_name, store_slug, store_bio, business_hours, wilaya, map_location, receipt_path, payment_reference, sender_info, plan_id, pro_days, currency, amount_dzd, amount_usd, payment_method, status, submitted_at, rejection_note").order("submitted_at", { ascending: false }),
    supabase.from("platform_settings").select("ccp_account_number, ccp_key, baridimob_rip, account_holder_name, support_phone, bybit_uid, bybit_pay_qr_url, usdt_wallet_address, promotion_plans, promo_codes").eq("id", "promotion_payments").maybeSingle(),
  ]);
  const firstError = [profileRows.error, documentRows.error, listingRows.error, categoryRows.error, disputeRows.error, promotionRows.error, proApplicationRows.error, settingsResult.error].find(Boolean);
  if (firstError) return <LoadError message={firstError.message} />;

  const profileById = new Map((profileRows.data ?? []).map((row) => [row.id, row]));
  const listingById = new Map((listingRows.data ?? []).map((row) => [row.id, row]));
  const documents = await Promise.all((documentRows.data ?? []).map(async (row) => {
    const owner = profileById.get(row.user_id);
    const { data, error } = await supabase.storage
      .from("ekrrili-identity-documents")
      .createSignedUrl(row.storage_path, 300);
    return {
      id: row.id,
      userId: row.user_id,
      fullName: owner?.full_name ?? "عضو اكريلي",
      phone: owner?.phone_number ?? "",
      status: row.status,
      submittedAt: row.submitted_at,
      signedUrl: error ? null : data.signedUrl,
      previewError: error?.message ?? null,
      rejectionNote: row.rejection_note,
    };
  }));
  const promotions = await Promise.all((promotionRows.data ?? []).map(async (row) => {
    const owner = profileById.get(row.owner_id);
    const listing = listingById.get(row.listing_id);
    const { data: receiptData, error: receiptError } = row.receipt_path
      ? await supabase.storage.from("listing-promotion-receipts").createSignedUrl(row.receipt_path, 3600)
      : { data: null, error: null };
    return {
      id: row.id,
      listingId: row.listing_id,
      listingTitle: listing?.title ?? "إعلان",
      ownerName: owner?.full_name ?? "عضو اكريلي",
      receiptUrl: receiptError ? null : receiptData?.signedUrl ?? null,
      status: row.status,
      submittedAt: row.submitted_at,
      rejectionNote: row.rejection_note,
      planId: row.plan_id ?? "",
      durationDays: row.duration_days ?? 0,
      amountDzd: row.amount_dzd ?? 0,
      amountUsd: Number(row.amount_usd ?? 0),
      currency: row.currency === "USD" ? "USD" as const : "DZD" as const,
      paymentMethod: row.payment_method === "bybit" ? "bybit" as const : row.payment_method === "ccp" ? "ccp" as const : "baridimob" as const,
      paymentReference: row.payment_reference ?? "",
      senderInfo: row.sender_info ?? "",
    };
  }));
  const proStoreApplications = await Promise.all((proApplicationRows.data ?? []).map(async (row) => {
    const owner = profileById.get(row.owner_id);
    const { data: receiptData, error: receiptError } = row.receipt_path
      ? await supabase.storage.from("pro-store-receipts").createSignedUrl(row.receipt_path, 3600)
      : { data: null, error: null };
    return {
      id: row.id,
      ownerId: row.owner_id,
      ownerName: owner?.full_name ?? "عضو اكريلي",
      storeName: row.store_name,
      slug: row.store_slug,
      bio: row.store_bio,
      businessHours: row.business_hours as Record<string, string>,
      wilaya: row.wilaya,
      paymentReference: row.payment_reference,
      planId: row.plan_id ?? "",
      proDays: row.pro_days,
      currency: row.currency === "USD" ? "USD" as const : "DZD" as const,
      amountDzd: row.amount_dzd ?? 0,
      amountUsd: Number(row.amount_usd ?? 0),
      paymentMethod: row.payment_method === "bybit" ? "bybit" as const : row.payment_method === "ccp" ? "ccp" as const : "baridimob" as const,
      senderInfo: row.sender_info ?? "",
      status: row.status,
      submittedAt: row.submitted_at,
      receiptUrl: receiptError ? null : receiptData?.signedUrl ?? null,
    };
  }));
  const listings = (listingRows.data ?? []).map((row) => {
    const category = Array.isArray(row.categories) ? row.categories[0] : row.categories;
    return {
      id: row.id,
      title: row.title,
      ownerId: row.owner_id,
      ownerName: profileById.get(row.owner_id)?.full_name ?? "عضو اكريلي",
      categoryName: category?.name_ar ?? "أخرى",
      price: Number(row.price_per_day),
      status: row.status,
      featured: row.is_featured && Boolean(row.featured_until) && new Date(row.featured_until).getTime() > Date.now(),
      featuredUntil: row.featured_until,
      image: row.images[0] ?? null,
      createdAt: row.created_at,
    };
  });
  const disputes = (disputeRows.data ?? []).map((row) => ({
    id: row.id,
    reporterId: row.reporter_id,
    reporterName: profileById.get(row.reporter_id)?.full_name ?? "عضو اكريلي",
    targetUserId: row.target_user_id,
    listingId: row.listing_id,
    listingTitle: listingById.get(row.listing_id ?? "")?.title ?? "إعلان",
    requestId: row.rental_request_id,
    reason: row.reason,
    details: row.details,
    status: row.status,
    createdAt: row.created_at,
    handoverLogs: [],
  }));
  const data: AdminDashboardData = {
    demoMode: false,
    profiles: (profileRows.data ?? []).map((row) => ({
      id: row.id,
      fullName: row.full_name,
      email: row.id === user.id ? user.email ?? "" : "",
      phone: row.phone_number ?? "",
      wilaya: row.wilaya ?? "",
      verified: row.identity_verified,
      suspended: row.is_suspended,
      role: row.role,
      isProStore: row.is_pro_store && Boolean(row.pro_until) && new Date(row.pro_until).getTime() > Date.now(),
      storeName: row.store_name,
      storeSlug: row.store_slug,
      proUntil: row.pro_until,
    })),
    documents,
    listings,
    rentals: [],
    categories: (categoryRows.data ?? []).map((row) => ({
      id: row.id,
      slug: row.slug,
      nameAr: row.name_ar,
      nameFr: row.name_fr,
      dynamicSchema: row.dynamic_schema,
    })),
    promotions,
    disputes,
    proStoreApplications,
    proStores: (profileRows.data ?? []).filter((row) => row.is_pro_store && row.pro_until && new Date(row.pro_until).getTime() > Date.now()).map((row) => ({
      ownerId: row.id,
      ownerName: row.full_name ?? "عضو اكريلي",
      storeName: row.store_name ?? "متجر PRO",
      slug: row.store_slug ?? "",
      proUntil: row.pro_until!,
    })),
    paymentSettings: (settingsResult.data ?? defaultPromotionPaymentSettings) as typeof defaultPromotionPaymentSettings,
  };

  return <AdminDashboard initialData={data} />;
}
