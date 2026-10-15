import Link from "next/link";
import { redirect } from "next/navigation";
import { LocalCheckout } from "@/features/promotions/local-checkout";
import { PromotionCheckout } from "@/features/promotions/promotion-checkout";
import { defaultPromotionPaymentSettings, type PromotionPaymentSettings } from "@/features/promotions/promotion-settings";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function CheckoutError({ message }: { message: string }) {
  return <main dir="rtl" lang="ar" className="min-h-screen bg-[#f7f8f6] p-6"><section className="mx-auto max-w-xl rounded-2xl bg-white p-6"><h1 className="text-xl font-extrabold">تعذر فتح صفحة الدفع</h1><p role="alert" className="mt-3 text-sm text-red-800">{message}</p><Link className="mt-5 inline-block text-sm font-bold text-[#176744]" href="/dashboard">العودة إلى لوحة التحكم</Link></section></main>;
}

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ listing?: string }> }) {
  const { listing: listingId } = await searchParams;
  if (!getSupabasePublicConfig()) return <LocalCheckout listingId={listingId ?? ""} />;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/checkout");

  const [settingsResult, listingResult] = await Promise.all([
    supabase.from("platform_settings")
      .select("ccp_account_number, ccp_key, baridimob_rip, account_holder_name, support_phone, bybit_uid, bybit_pay_qr_url, usdt_wallet_address, promotion_plans")
      .eq("id", "promotion_payments").maybeSingle(),
    listingId ? supabase.from("listings").select("id, title").eq("id", listingId).eq("owner_id", user.id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);
  if (settingsResult.error || listingResult.error) return <CheckoutError message={settingsResult.error?.message ?? listingResult.error?.message ?? "تعذر تحميل البيانات."} />;
  if (listingId && !listingResult.data) return <CheckoutError message="الإعلان غير موجود أو لا تملك صلاحية ترقيته." />;

  return (
    <main dir="rtl" lang="ar" className="min-h-screen bg-[#f7f8f6] px-3 py-6">
      <PromotionCheckout
        target={listingResult.data ? { type: "featured", listingId: listingResult.data.id, listingTitle: listingResult.data.title } : { type: "pro_store" }}
        settings={(settingsResult.data ?? defaultPromotionPaymentSettings) as PromotionPaymentSettings}
        demoMode={false}
      />
    </main>
  );
}
