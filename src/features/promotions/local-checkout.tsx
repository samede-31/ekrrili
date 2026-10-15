"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getLocalMarketplace } from "@/features/listings/local-marketplace";
import { PromotionCheckout } from "@/features/promotions/promotion-checkout";
import { defaultPromotionPaymentSettings, type PromotionPaymentSettings } from "@/features/promotions/promotion-settings";

type Target = { type: "featured"; listingId: string; listingTitle: string } | { type: "pro_store" };

export function LocalCheckout({ listingId }: { listingId: string }) {
  const [target, setTarget] = useState<Target | null>(null);
  const [settings, setSettings] = useState<PromotionPaymentSettings>(defaultPromotionPaymentSettings);
  const [error, setError] = useState("");
  useEffect(() => {
    const state = getLocalMarketplace();
    setSettings(state.promotionSettings ?? defaultPromotionPaymentSettings);
    if (!listingId) {
      setTarget({ type: "pro_store" });
      return;
    }
    const listing = state.listings.find((item) => item.id === listingId);
    if (!listing) {
      setError("الإعلان غير موجود في وضع العرض المحلي.");
      return;
    }
    setTarget({ type: "featured", listingId: listing.id, listingTitle: listing.title.ar });
  }, [listingId]);
  return (
    <main dir="rtl" lang="ar" className="min-h-screen bg-[#f7f8f6] px-3 py-6">
      <Link href="/dashboard" className="mx-auto mb-4 block max-w-3xl text-xs font-bold text-[#176744]">العودة إلى لوحة التحكم</Link>
      {error && <p role="alert" className="mx-auto max-w-xl rounded-xl bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      {target && <PromotionCheckout target={target} settings={settings} demoMode onClose={() => { window.location.href = "/dashboard"; }} />}
    </main>
  );
}
