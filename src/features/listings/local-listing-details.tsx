"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ListingDetails } from "@/features/listings/listing-details";
import { getLocalMarketplace, type LocalListing } from "@/features/listings/local-marketplace";
import { categories, locations } from "@/features/listings/listing-options";

export function LocalListingDetails({ id }: { id: string }) {
  const [listing, setListing] = useState<LocalListing | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const load = () => {
      const state = getLocalMarketplace();
      const currentListing = state.listings.find((item) => item.id === id) ?? null;
      setListing(currentListing);
      setLoaded(true);
    };
    load();
    window.addEventListener("ekrrili-local-marketplace-change", load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener("ekrrili-local-marketplace-change", load);
      window.removeEventListener("storage", load);
    };
  }, [id]);

  if (!loaded) {
    return <main dir="rtl" lang="ar" className="min-h-screen bg-[#f7f8f6] px-4 py-16 text-center text-sm text-[#718078]">جارٍ تحميل الإعلان…</main>;
  }

  if (!listing) {
    return (
      <main dir="rtl" lang="ar" className="min-h-screen bg-[#f7f8f6] px-4 py-16 text-center">
        <h1 className="text-xl font-extrabold">الإعلان غير موجود في هذا المتصفح</h1>
        <p className="mt-2 text-sm text-[#718078]">افتح هذا الرابط في المتصفح الذي أنشأ الإعلان.</p>
        <Link href="/" className="mt-5 inline-flex rounded-xl bg-[#17734e] px-4 py-2 text-sm font-bold text-white">العودة إلى السوق</Link>
      </main>
    );
  }

  const category = categories.find((item) => item.id === listing.category);
  const wilaya = locations.find((item) => item.code === listing.wilaya);
  return (
    <ListingDetails
      listing={{
        id: listing.id,
        title: listing.title.ar,
        description: listing.description,
        categoryId: listing.category,
        categoryName: category?.label.ar ?? "إعلان",
        pricePerDay: listing.price,
        pricePerWeek: listing.pricePerWeek,
        pricePerMonth: listing.pricePerMonth,
        deliveryAvailable: listing.deliveryAvailable,
        deliveryFeeDzd: listing.deliveryFeeDzd,
        addons: listing.addons,
        cautionAmount: listing.caution,
        cautionType: listing.cautionType,
        wilayaCode: listing.wilaya,
        wilayaName: wilaya?.name.ar ?? listing.wilaya,
        commune: listing.commune,
        images: listing.images,
        metadata: listing.metadata,
        condition: listing.condition,
        status: listing.status,
        featured: listing.featured,
        owner: {
          id: listing.ownerId,
          fullName: listing.owner.ar,
          identityVerified: listing.verified,
          rating: listing.rating,
          avatarUrl: null,
          responseRate: listing.responseRate,
        },
      }}
      demo
      ownerIsViewer={false}
      isAuthenticated={false}
    />
  );
}
