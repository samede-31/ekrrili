import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CircleAlert } from "lucide-react";
import { ListingDetails } from "@/features/listings/listing-details";
import { LocalListingDetails } from "@/features/listings/local-listing-details";
import { locations, type CategoryId } from "@/features/listings/listing-options";
import { demoListings } from "@/features/listings/demo-listings";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : undefined;
  const pagePath = `/listings/${encodeURIComponent(id)}`;

  if (!getSupabasePublicConfig()) {
    const listing = demoListings.find((item) => item.id === id);
    if (!listing) return { title: "إعلان للكراء", alternates: { canonical: pagePath } };
    const title = listing.title.ar;
    const wilaya = locations.find((item) => item.code === listing.wilaya)?.name.ar ?? listing.wilaya;
    const description = `${title} في ${wilaya} — ${new Intl.NumberFormat("fr-DZ").format(listing.price)} د.ج / اليوم. تواصل مباشرة مع صاحب الإعلان على اكريلي.`;
    const image = listing.images.find((value) => value.startsWith("https://") || value.startsWith("/"));
    return {
      title,
      description,
      alternates: { canonical: pagePath },
      openGraph: {
        type: "website",
        title,
        description,
        url: pagePath,
        siteName: "اكريلي - Ekrrili",
        locale: "ar_DZ",
        images: image ? [{ url: image, alt: title }] : [],
      },
      twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : [] },
      ...(baseUrl ? { metadataBase: baseUrl } : {}),
    };
  }

  const supabase = await createSupabaseServerClient();
  const { data: listing, error } = await supabase
    .from("listings")
    .select("id, title, description, price_per_day, wilaya, images, status")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`تعذر تحميل بيانات معاينة الإعلان: ${error.message}`);
  if (!listing || listing.status !== "active") return { title: "إعلان للكراء", alternates: { canonical: pagePath } };
  const wilaya = locations.find((item) => item.code === listing.wilaya)?.name.ar ?? listing.wilaya;
  const title = listing.title;
  const description = `${listing.description.slice(0, 180)} · ${new Intl.NumberFormat("fr-DZ").format(Number(listing.price_per_day))} د.ج / اليوم · ${wilaya}`;
  const imageValues: unknown[] = Array.isArray(listing.images) ? listing.images : [];
  const image = imageValues.find((value): value is string =>
    typeof value === "string" && (value.startsWith("https://") || value.startsWith("/")));
  return {
    title,
    description,
    alternates: { canonical: pagePath },
    openGraph: {
      type: "website",
      title,
      description,
      url: pagePath,
      siteName: "اكريلي - Ekrrili",
      locale: "ar_DZ",
      images: image ? [{ url: image, alt: title }] : [],
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : [] },
    ...(baseUrl ? { metadataBase: baseUrl } : {}),
  };
}

function isCategoryId(value: string): value is CategoryId {
  return ["camera", "vehicle", "machinery", "electronics", "event", "camping", "real-estate"].includes(value);
}

export default async function ListingDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const config = getSupabasePublicConfig();

  if (!config) {
    return <LocalListingDetails id={id} />;
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) {
    return <ListingLoadError message={authError.message} />;
  }
  const { error: expirationError } = await supabase.rpc("expire_featured_listings");
  if (expirationError) return <ListingLoadError message={`تعذر تحديث حالة التمييز: ${expirationError.message}`} />;

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id, owner_id, category_id, title, description, price_per_day, price_per_week, price_per_month, delivery_available, delivery_fee_dzd, addons, caution_deposit_amount, caution_type, wilaya, commune, images, metadata, item_condition, status, is_featured, featured_until")
    .eq("id", id)
    .maybeSingle();
  if (listingError) return <ListingLoadError message={listingError.message} />;
  if (!listing || !isCategoryId(listing.category_id)) notFound();

  const [
    { data: category, error: categoryError },
    { data: profile, error: profileError },
  ] = await Promise.all([
    supabase.from("categories").select("name_ar, dynamic_schema").eq("id", listing.category_id).maybeSingle(),
    supabase.from("public_profiles").select("id, full_name, identity_verified, rating, avatar_url").eq("id", listing.owner_id).maybeSingle(),
  ]);
  if (categoryError || profileError) return <ListingLoadError message={categoryError?.message ?? profileError?.message ?? "تعذر تحميل بيانات المالك."} />;
  if (!category || !profile) notFound();

  const categorySchema = category.dynamic_schema;
  const schemaFields = typeof categorySchema === "object" && categorySchema !== null && !Array.isArray(categorySchema)
    ? "fields" in categorySchema && Array.isArray(categorySchema.fields)
      ? categorySchema.fields
      : []
    : [];
  const metadata = listing.metadata && typeof listing.metadata === "object" && !Array.isArray(listing.metadata)
    ? listing.metadata as Record<string, unknown>
    : {};

  return (
    <ListingDetails
      listing={{
        id: listing.id,
        title: listing.title,
        description: listing.description,
        categoryId: listing.category_id,
        categoryName: category.name_ar,
        pricePerDay: Number(listing.price_per_day),
        pricePerWeek: listing.price_per_week === null ? null : Number(listing.price_per_week),
        pricePerMonth: listing.price_per_month === null ? null : Number(listing.price_per_month),
        deliveryAvailable: listing.delivery_available,
        deliveryFeeDzd: Number(listing.delivery_fee_dzd),
        addons: Array.isArray(listing.addons) ? listing.addons as Array<{ name: string; price_per_day_dzd: number }> : [],
        cautionAmount: Number(listing.caution_deposit_amount),
        cautionType: listing.caution_type,
        wilayaCode: listing.wilaya,
        wilayaName: locations.find((location) => location.code === listing.wilaya)?.name.ar ?? listing.wilaya,
        commune: listing.commune,
        images: listing.images ?? [],
        metadata,
        condition: listing.item_condition,
        status: listing.status,
        featured: listing.is_featured && Boolean(listing.featured_until) && new Date(listing.featured_until).getTime() > Date.now(),
        owner: {
          id: profile.id,
          fullName: profile.full_name || "عضو اكريلي",
          identityVerified: profile.identity_verified,
          rating: Number(profile.rating),
          avatarUrl: profile.avatar_url,
          responseRate: null,
        },
      }}
      dynamicFields={schemaFields}
      demo={false}
      ownerIsViewer={user?.id === listing.owner_id}
      isAuthenticated={Boolean(user)}
    />
  );
}

function ListingLoadError({ message }: { message: string }) {
  return (
    <main dir="rtl" lang="ar" className="min-h-screen bg-[#f7f8f6] px-4 py-12">
      <section className="mx-auto max-w-xl rounded-3xl border border-red-100 bg-white p-7">
        <CircleAlert size={22} className="text-red-700" />
        <h1 className="mt-4 text-xl font-extrabold">تعذّر تحميل الإعلان</h1>
        <p role="alert" className="mt-2 text-sm leading-7 text-red-800">{message}</p>
      </section>
    </main>
  );
}
