"use client";

import { useEffect, useState } from "react";
import { Dashboard } from "@/features/dashboard/dashboard";
import { getLocalMarketplace, makeInitialLocalMarketplace, LOCAL_OWNER_ID } from "@/features/listings/local-marketplace";
import { categories, locations } from "@/features/listings/listing-options";
import { defaultPromotionPaymentSettings } from "@/features/promotions/promotion-settings";

export function LocalDashboard() {
  const [state, setState] = useState(makeInitialLocalMarketplace);

  useEffect(() => {
    const refresh = () => setState(getLocalMarketplace());
    refresh();
    window.addEventListener("ekrrili-local-marketplace-change", refresh);
    window.addEventListener("storage", refresh);
    const timer = window.setInterval(refresh, 30_000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("ekrrili-local-marketplace-change", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return (
    <Dashboard
      demoMode
      userEmail="demo@ekrrili.local"
      profile={{
        id: LOCAL_OWNER_ID,
        full_name: state.profile?.fullName ?? "عضو تجريبي",
        phone_number: state.profile?.phoneNumber ?? null,
        identity_verified: false,
        avatar_url: null,
        wilaya: locations.find((item) => item.code === state.profile?.wilaya)?.name.ar ?? null,
      }}
      listings={state.listings.filter((listing) => listing.ownerId === LOCAL_OWNER_ID).map((listing) => ({
        id: listing.id,
        title: listing.title.ar,
        description: listing.description,
        pricePerDay: listing.price,
        cautionAmount: listing.caution,
        wilaya: listing.wilaya,
        commune: listing.commune,
        status: listing.status,
        image: listing.images[0] ?? null,
        categoryName: categories.find((item) => item.id === listing.category)?.label.ar ?? "إعلان",
        isFeatured: Boolean(listing.featured),
        featuredUntil: listing.featuredUntil ?? null,
      }))}
      latestIdentityStatus={null}
      paymentSettings={state.promotionSettings ?? defaultPromotionPaymentSettings}
      proStore={(state.proStores ?? []).find((store) => store.ownerId === LOCAL_OWNER_ID && Date.parse(store.proUntil) > Date.now())
        ? (() => {
          const store = (state.proStores ?? []).find((item) => item.ownerId === LOCAL_OWNER_ID)!;
          return { name: store.storeName, slug: store.slug, until: store.proUntil };
        })()
        : null}
    />
  );
}
