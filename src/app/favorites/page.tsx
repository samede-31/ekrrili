import { DiscoveryPage } from "@/features/marketplace/discovery-page";
import type { DemoListing } from "@/features/listings/demo-listings";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  if (!getSupabasePublicConfig()) return <DiscoveryPage demoMode favoritesOnly />;
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) return <main dir="rtl" className="p-8"><p role="alert">{authError.message}</p></main>;
  const [{ data: favoriteRows, error: favoriteError }, { data: rows, error: listingError }] = await Promise.all([
    user ? supabase.from("listing_favorites").select("listing_id").eq("user_id", user.id) : Promise.resolve({ data: [], error: null }),
    supabase.from("listings").select("id, owner_id, category_id, title, description, price_per_day, caution_deposit_amount, caution_type, wilaya, commune, images, metadata, is_featured, featured_until").eq("status", "active").limit(100),
  ]);
  if (favoriteError || listingError) return <main dir="rtl" className="p-8"><p role="alert">{favoriteError?.message ?? listingError?.message}</p></main>;
  const ids = (favoriteRows ?? []).map((item) => item.listing_id);
  const categoryIds = [...new Set((rows ?? []).map((row) => row.category_id))];
  const ownerIds = [...new Set((rows ?? []).map((row) => row.owner_id))];
  const [{ data: categories, error: categoryError }, { data: profiles, error: profileError }] = await Promise.all([
    categoryIds.length ? supabase.from("categories").select("id, slug").in("id", categoryIds) : Promise.resolve({ data: [], error: null }),
    ownerIds.length ? supabase.from("public_profiles").select("id, full_name, identity_verified, rating").in("id", ownerIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (categoryError || profileError) return <main dir="rtl" className="p-8"><p role="alert">{categoryError?.message ?? profileError?.message}</p></main>;
  const categoryById = new Map((categories ?? []).map((category) => [category.id, category]));
  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const initialListings: DemoListing[] = (rows ?? []).flatMap((row) => {
    const category = categoryById.get(row.category_id);
    const profile = profileById.get(row.owner_id);
    if (!category || !["camera","vehicle","machinery","electronics","event","camping","real-estate"].includes(category.slug)) return [];
    return [{
      id: row.id, title: { ar: row.title, fr: row.title }, description: row.description,
      category: category.slug as DemoListing["category"], wilaya: row.wilaya, commune: row.commune,
      price: Number(row.price_per_day), caution: Number(row.caution_deposit_amount), cautionType: row.caution_type,
      rating: Number(profile?.rating ?? 0), reviews: 0,
      owner: { ar: profile?.full_name ?? "عضو اكريلي", fr: profile?.full_name ?? "Membre Ekrrili" },
      ownerPhone: "", verified: Boolean(profile?.identity_verified), responseRate: null,
      images: row.images ?? [], metadata: row.metadata ?? {}, condition: "",
      featured: Boolean(row.is_featured && row.featured_until && Date.parse(row.featured_until) > Date.now()),
      featuredUntil: row.featured_until,
    }];
  });
  return <DiscoveryPage demoMode={false} initialListings={initialListings} initialFavoriteIds={ids} favoritesOnly />;
}
