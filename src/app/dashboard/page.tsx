import { redirect } from "next/navigation";
import { Dashboard } from "@/features/dashboard/dashboard";
import { LocalDashboard } from "@/features/dashboard/local-dashboard";
import { defaultPromotionPaymentSettings, type PromotionPaymentSettings } from "@/features/promotions/promotion-settings";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  if (!getSupabasePublicConfig()) return <LocalDashboard />;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard");

  const { error: expirationError } = await supabase.rpc("expire_featured_listings");
  if (expirationError) {
    return <main dir="rtl" lang="ar" className="min-h-screen bg-[#f7f8f6] px-4 py-12"><p role="alert" className="mx-auto max-w-xl rounded-2xl bg-white p-6 text-sm text-red-800">{expirationError.message}</p></main>;
  }
  const { error: proExpirationError } = await supabase.rpc("expire_pro_stores");
  if (proExpirationError) {
    return <main dir="rtl" lang="ar" className="min-h-screen bg-[#f7f8f6] px-4 py-12"><p role="alert" className="mx-auto max-w-xl rounded-2xl bg-white p-6 text-sm text-red-800">{proExpirationError.message}</p></main>;
  }

  const [
    { data: profile, error: profileError },
    { data: listingRows, error: listingError },
    { data: documentRow, error: documentError },
    { data: notificationRows, error: notificationError },
    { data: settingsRow, error: settingsError },
  ] = await Promise.all([
    supabase.from("profiles").select("id, full_name, phone_number, identity_verified, avatar_url, wilaya, is_pro_store, store_name, store_slug, store_bio, store_wilaya, business_hours, map_location, pro_until").eq("id", user.id).maybeSingle(),
    supabase.from("listings").select("id, title, description, price_per_day, caution_deposit_amount, wilaya, commune, status, is_featured, featured_until, images, created_at, categories(name_ar)").eq("owner_id", user.id).order("created_at", { ascending: false }),
    supabase.from("identity_documents").select("status, submitted_at").eq("user_id", user.id).order("submitted_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("notifications").select("id, title, body, created_at, read_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("platform_settings").select("ccp_account_number, ccp_key, baridimob_rip, account_holder_name, support_phone, bybit_uid, bybit_pay_qr_url, usdt_wallet_address, promotion_plans").eq("id", "promotion_payments").maybeSingle(),
  ]);

  const firstError = profileError ?? listingError ?? documentError ?? notificationError ?? settingsError;
  if (firstError) {
    return (
      <main dir="rtl" lang="ar" className="min-h-screen bg-[#f7f8f6] px-4 py-12">
        <section className="mx-auto max-w-xl rounded-3xl border border-red-100 bg-white p-7">
          <h1 className="text-xl font-extrabold text-[#17231d]">تعذّر تحميل لوحة التحكم</h1>
          <p role="alert" className="mt-3 text-sm leading-7 text-red-800">{firstError.message}</p>
          <p className="mt-2 text-xs leading-6 text-[#748078]">تحقق من تشغيل ترحيلات Supabase وسياسات RLS ثم أعد المحاولة.</p>
        </section>
      </main>
    );
  }

  return (
    <Dashboard
      userEmail={user.email ?? user.phone ?? ""}
      profile={profile ?? {
        id: user.id,
        full_name: String(user.user_metadata?.full_name ?? ""),
        phone_number: user.phone ?? null,
        identity_verified: false,
        avatar_url: null,
        wilaya: null,
        is_pro_store: false,
        store_name: null,
        store_slug: null,
        store_bio: null,
        store_wilaya: null,
        business_hours: {},
        map_location: null,
        pro_until: null,
      }}
      listings={(listingRows ?? []).map((listing) => {
        const category = Array.isArray(listing.categories) ? listing.categories[0] : listing.categories;
        return {
          id: listing.id,
          title: listing.title,
          description: listing.description,
          pricePerDay: Number(listing.price_per_day),
          cautionAmount: Number(listing.caution_deposit_amount),
          wilaya: listing.wilaya,
          commune: listing.commune,
          status: listing.status,
          isFeatured: listing.is_featured && Boolean(listing.featured_until) && new Date(listing.featured_until).getTime() > Date.now(),
          featuredUntil: listing.featured_until,
          image: listing.images[0] ?? null,
          categoryName: category?.name_ar ?? "إعلان",
        };
      })}
      latestIdentityStatus={documentRow?.status ?? null}
      initialNotifications={(notificationRows ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        createdAt: row.created_at,
        read: Boolean(row.read_at),
      }))}
      paymentSettings={(settingsRow ?? defaultPromotionPaymentSettings) as PromotionPaymentSettings}
      proStore={profile?.is_pro_store && profile.pro_until ? {
        name: profile.store_name ?? "",
        slug: profile.store_slug ?? "",
        until: profile.pro_until,
      } : null}
    />
  );
}
