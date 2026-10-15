import { DiscoveryPage } from "@/features/marketplace/discovery-page";
import { categories as listingCategories } from "@/features/listings/listing-options";
import type { DemoListing } from "@/features/listings/demo-listings";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!getSupabasePublicConfig()) return <DiscoveryPage demoMode />;
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) return <DiscoveryPage demoMode={false} loadError={`تعذر التحقق من الجلسة: ${authError.message}`} />;
  const { error: expirationError } = await supabase.rpc("expire_featured_listings");
  if (expirationError) return <DiscoveryPage demoMode={false} loadError={`تعذر تحديث حالة الإعلانات المميزة: ${expirationError.message}`} />;
  const [
    { data: categoryRows, error: categoryError },
    { data: listingRows, error: listingError },
    { data: notificationRows, error: notificationError },
    { data: favoriteRows, error: favoriteError },
  ] = await Promise.all([
    supabase.from("categories").select("id, slug, name_ar, name_fr"),
    supabase.from("listings")
      .select("id, owner_id, category_id, title, description, price_per_day, caution_deposit_amount, caution_type, wilaya, commune, images, metadata, status, is_featured, featured_until")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(100),
    user
      ? supabase.from("notifications").select("id, title, body, created_at, read_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20)
      : Promise.resolve({ data: [], error: null }),
    user ? supabase.from("listing_favorites").select("listing_id").eq("user_id", user.id) : Promise.resolve({ data: [], error: null }),
  ]);
  const firstError = categoryError ?? listingError ?? notificationError ?? favoriteError;
  if (firstError) return <DiscoveryPage demoMode={false} loadError={`تعذّر تحميل الإعلانات من Supabase: ${firstError.message}`} initialListings={[]} />;

  const ownerIds = [...new Set((listingRows ?? []).map((listing) => listing.owner_id))];
  const { data: profiles, error: profileError } = ownerIds.length
    ? await supabase.from("public_profiles").select("id, full_name, identity_verified, rating").in("id", ownerIds)
    : { data: [], error: null };
  if (profileError) {
    return <DiscoveryPage demoMode={false} loadError={`تعذّر تحميل ملفات أصحاب الإعلانات: ${profileError.message}`} initialListings={[]} />;
  }
  const categoryById = new Map((categoryRows ?? []).map((category) => [category.id, category]));
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const supportedCategories = new Set(listingCategories.map((category) => category.id));
  const liveCategories = (categoryRows ?? []).flatMap((category) =>
    supportedCategories.has(category.slug as DemoListing["category"])
      ? [{
        id: category.slug as DemoListing["category"],
        name: { ar: category.name_ar, fr: category.name_fr },
      }]
      : [],
  );
  const liveListings: DemoListing[] = (listingRows ?? []).flatMap((row) => {
    const category = categoryById.get(row.category_id);
    if (!category || !supportedCategories.has(category.slug as DemoListing["category"])) return [];
    const profile = profileById.get(row.owner_id);
    const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? row.metadata as Record<string, unknown>
      : {};
    return [{
      id: row.id,
      title: { ar: row.title, fr: row.title },
      description: row.description,
      category: category.slug as DemoListing["category"],
      wilaya: row.wilaya,
      commune: row.commune,
      price: Number(row.price_per_day),
      caution: Number(row.caution_deposit_amount),
      cautionType: row.caution_type,
      rating: Number(profile?.rating ?? 0),
      reviews: 0,
      owner: { ar: profile?.full_name || "عضو اكريلي", fr: profile?.full_name || "Membre Ekrrili" },
      ownerPhone: "",
      verified: Boolean(profile?.identity_verified),
      featured: row.is_featured && Boolean(row.featured_until) && new Date(row.featured_until).getTime() > Date.now(),
      featuredUntil: row.featured_until,
      badge: row.is_featured && row.featured_until && new Date(row.featured_until).getTime() > Date.now()
        ? { ar: "إعلان مميز", fr: "À la une" }
        : undefined,
      responseRate: null,
      images: row.images ?? [],
      metadata,
      condition: "تُحدد الحالة عند التسليم.",
    }];
  });
  return <DiscoveryPage
    demoMode={false}
    initialListings={liveListings}
    initialCategories={liveCategories}
    initialFavoriteIds={(favoriteRows ?? []).map((row) => row.listing_id)}
    initialNotifications={(notificationRows ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      createdAt: row.created_at,
      read: Boolean(row.read_at),
    }))}
  />;
}
