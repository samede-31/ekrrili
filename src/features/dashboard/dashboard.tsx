"use client";

import {
  BadgeCheck,
  CalendarDays,
  Check,
  ChevronLeft,
  CircleAlert,
  FileCheck2,
  FileText,
  Heart,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  MapPin,
  Pause,
  Pencil,
  Plus,
  ShieldCheck,
  Star,
  Trash2,
  UserRound,
  Wallet,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useSiteLanguage } from "@/components/site-preferences";
import { Button } from "@/components/ui/button";
import { FieldLabel, Input, Select, Textarea } from "@/components/ui/field";
import { locations } from "@/features/listings/listing-options";
import { NotificationBell, type NotificationItem } from "@/features/notifications/notification-bell";
import { ReportDisputeModal } from "@/features/disputes/report-dispute-modal";
import { PromotionCheckout } from "@/features/promotions/promotion-checkout";
import { defaultPromotionPaymentSettings, type PromotionPaymentSettings } from "@/features/promotions/promotion-settings";
import {
  deleteOwnedListing,
  setOwnedListingStatus,
  signOut,
  submitIdentityDocument,
  updateDashboardProfile,
  updateOwnedListing,
} from "@/features/dashboard/dashboard-actions";
import {
  deleteLocalListing,
  setLocalListingStatus,
  updateLocalListing,
  updateLocalProfile,
} from "@/features/listings/local-marketplace";

type ListingStatus = "active" | "paused" | "rented";
type RentalStatus = "pending" | "approved" | "active" | "completed" | "cancelled";
type DashboardListing = {
  id: string;
  title: string;
  description: string;
  pricePerDay: number;
  cautionAmount: number;
  wilaya: string;
  commune: string;
  status: ListingStatus;
  image: string | null;
  categoryName: string;
  isFeatured: boolean;
  featuredUntil: string | null;
};

type DashboardRequest = {
  id: string;
  listingId: string;
  listingTitle: string;
  startDate: string;
  endDate: string;
  totalPrice: number;
  renterReliability?: { completedRentals: number; verified: boolean; rating: number };
  cautionAmount: number;
  status: RentalStatus;
  createdAt: string;
  ownerId: string;
  renterId: string;
  userHasReviewed: boolean;
  handoverLogs: Array<{
    id: string;
    requestId: string;
    userId: string;
    phase: "check_in" | "check_out";
    notes: string;
    photoUrls: string[];
    createdAt: string;
  }>;
};

type DashboardProfile = {
  id: string;
  full_name: string;
  phone_number: string | null;
  identity_verified: boolean;
  avatar_url: string | null;
  wilaya: string | null;
};

type Props = {
  demoMode?: boolean;
  userEmail: string;
  profile: DashboardProfile;
  listings: DashboardListing[];
  latestIdentityStatus: string | null;
  initialNotifications?: NotificationItem[];
  paymentSettings?: PromotionPaymentSettings;
  proStore?: { name: string; slug: string; until: string } | null;
};

const money = new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat("ar-DZ", { dateStyle: "medium" });

function displayDate(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : date.format(parsed);
}

function formatDzd(amount: number) {
  return `${money.format(amount)} د.ج`;
}

function isListingFeatured(listing: DashboardListing, now: number) {
  return listing.isFeatured && Boolean(listing.featuredUntil) && Date.parse(listing.featuredUntil!) > now;
}

export function Dashboard({
  demoMode = false,
  userEmail,
  profile,
  listings,
  latestIdentityStatus,
  initialNotifications = [],
  paymentSettings = defaultPromotionPaymentSettings,
  proStore = null,
}: Props) {
  const language = useSiteLanguage();
  const dashboardCopy = language === "en"
    ? { favorites: "Favorites", admin: "Admin Panel", add: "Post an ad", market: "Marketplace", logout: "Sign out", listings: "My listings", profile: "Profile", demo: "Demo mode: identity documents are not uploaded or sent to a server.", verified: "Verified account", pending: "Identity under review", unverified: "Identity not verified", sections: "Dashboard sections", back: "Back to marketplace", account: "Account management", heading: "Manage your listings, rental contacts, and trust information." }
    : language === "fr"
      ? { favorites: "Favoris", admin: "Administration", add: "Déposer une annonce", market: "Marché", logout: "Déconnexion", listings: "Mes annonces", profile: "Profil", demo: "Mode démo : les documents d'identité ne sont pas envoyés au serveur.", verified: "Compte vérifié", pending: "Identité en cours de vérification", unverified: "Identité non vérifiée", sections: "Sections du tableau de bord", back: "Retour au marché", account: "Gestion du compte", heading: "Gérez vos annonces, vos contacts et vos informations de confiance." }
      : { favorites: "المفضلة", admin: "لوحة الإدارة", add: "أضف إعلاناً", market: "السوق", logout: "تسجيل الخروج", listings: "إعلاناتي", profile: "الملف الشخصي", demo: "وضع تجريبي: لا يتم رفع وثائق الهوية أو إرسالها إلى خادم.", verified: "حساب موثّق", pending: "الهوية قيد المراجعة", unverified: "الهوية غير موثّقة", sections: "أقسام لوحة التحكم", back: "العودة إلى السوق", account: "مساحة إدارة حسابك", heading: "إدارة إعلاناتك وحجوزاتك ومعلومات الثقة الخاصة بك." };
  const [section, setSection] = useState<"listings" | "profile">("listings");
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({});
  const [busy, setBusy] = useState("");
  const [editingListing, setEditingListing] = useState<string | null>(null);
  const [deletingListing, setDeletingListing] = useState<DashboardListing | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [checkoutTarget, setCheckoutTarget] = useState<{ type: "featured"; listingId: string; listingTitle: string } | { type: "pro_store" } | null>(null);
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const runAction = async (key: string, action: () => Promise<{ error?: string; success?: string }>) => {
    setBusy(key);
    setFeedback({});
    let result: { error?: string; success?: string };
    try {
      result = await action();
    } catch (caught) {
      result = { error: caught instanceof Error ? caught.message : "تعذر إكمال العملية." };
    }
    setFeedback(result);
    setBusy("");
    if (result.success) router.refresh();
    return result;
  };

  const saveListing = (event: FormEvent<HTMLFormElement>, id: string) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("id", id);
    const action = demoMode
      ? Promise.resolve().then(() => {
        updateLocalListing(id, {
          title: String(formData.get("title") ?? ""),
          description: String(formData.get("description") ?? ""),
          price: Number(formData.get("pricePerDay")),
        });
        return { success: "تم حفظ الإعلان في هذا المتصفح." };
      })
      : updateOwnedListing(formData);
    void runAction(`listing:${id}`, () => action).then((result) => {
      if (result.success) setEditingListing(null);
    });
  };

  const saveProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const action = demoMode
      ? Promise.resolve().then(() => {
        updateLocalProfile({
          fullName: String(data.get("fullName") ?? ""),
          phoneNumber: String(data.get("phoneNumber") ?? ""),
          wilaya: String(data.get("wilaya") ?? ""),
        });
        return { success: "تم حفظ الملف الشخصي في هذا المتصفح." };
      })
      : updateDashboardProfile(data);
    void runAction("profile", () => action);
  };

  const uploadIdentity = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const action = demoMode
      ? Promise.resolve({ error: "رفع وثائق الهوية غير متاح في وضع العرض التجريبي." })
      : submitIdentityDocument(formData);
    void runAction("identity", () => action).then((result) => {
      if (result.success) form.reset();
    });
  };

  const setListingStatus = (id: string, status: "active" | "paused") =>
    demoMode
      ? Promise.resolve().then(() => { setLocalListingStatus(id, status); return { success: "تم تحديث حالة الإعلان." }; })
      : setOwnedListingStatus(id, status);

  const removeListing = (id: string) =>
    demoMode
      ? Promise.resolve().then(() => { deleteLocalListing(id); return { success: "تم حذف الإعلان." }; })
      : deleteOwnedListing(id);

  const tabItems = [
    { id: "listings" as const, label: dashboardCopy.listings, icon: LayoutDashboard, count: listings.length },
    { id: "profile" as const, label: dashboardCopy.profile, icon: UserRound },
  ];

  return (
    <main dir={language === "ar" ? "rtl" : "ltr"} lang={language} className="min-h-screen bg-[#f7f8f6] text-[#17231d]">
      <header className="border-b border-[#e6ebe7] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="text-base font-extrabold tracking-wide text-[#176744]">اكريلي <span dir="ltr" className="text-[10px] tracking-[0.18em] text-[#7d8b81]">EKRRILI</span></Link>
          <div className="flex items-center gap-3">
            <NotificationBell demoMode={demoMode} initialNotifications={initialNotifications} />
            <Link href="/favorites" className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-[#e0e7e1] px-3 text-xs font-bold text-[#526159]"><Heart size={15} /> <span className="hidden sm:inline">{dashboardCopy.favorites}</span></Link>
            <Link href="/admin" className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-[#edf5ef] px-3 text-xs font-extrabold text-[#176744] hover:bg-[#dcefe2]">
              <ShieldCheck size={15} /> <span className="hidden sm:inline">{dashboardCopy.admin}</span>
            </Link>
            <Link href="/list-an-item" className="hidden items-center gap-2 rounded-xl bg-[#17734e] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#10583b] sm:inline-flex">
              <Plus size={15} /> {dashboardCopy.add}
            </Link>
            {demoMode
              ? <Link href="/" className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-[#dfe6e0] px-3 text-xs font-semibold text-[#35463b]"><LogOut size={15} /> {dashboardCopy.market}</Link>
              : <form action={signOut}><Button type="submit" variant="outline" size="small"><LogOut size={15} /> <span className="hidden sm:inline">{dashboardCopy.logout}</span></Button></form>}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-7 sm:px-6 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-8 lg:py-10">
        <aside>
          <div className="rounded-3xl border border-[#e4eae5] bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eaf3ec] text-lg font-extrabold text-[#176744]">
                {profile.full_name?.slice(0, 1) || <UserRound size={21} />}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold">{profile.full_name || "عضو اكريلي"}</p>
                <p dir="ltr" className="truncate text-start text-[11px] text-[#849087]">{userEmail}</p>
              </div>
            </div>
            {demoMode && <p className="mb-4 rounded-xl bg-[#fff9e9] p-3 text-xs leading-5 text-[#725d2c]">{dashboardCopy.demo}</p>}
            {profile.identity_verified ? (
              <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-800"><BadgeCheck size={14} /> {dashboardCopy.verified}</p>
            ) : (
              <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-[11px] font-bold text-amber-800"><ShieldCheck size={14} /> {latestIdentityStatus === "pending" ? dashboardCopy.pending : dashboardCopy.unverified}</p>
            )}
          </div>
          <nav aria-label={dashboardCopy.sections} className="mt-4 grid grid-cols-4 gap-2 rounded-2xl border border-[#e4eae5] bg-white p-2 lg:grid-cols-1 lg:p-3">
            {tabItems.map(({ id, label, icon: Icon, count }) => (
              <button key={id} type="button" onClick={() => { setSection(id); setFeedback({}); }} aria-current={section === id ? "page" : undefined} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-xs font-bold transition lg:justify-start lg:text-sm ${section === id ? "bg-[#edf5ef] text-[#176744]" : "text-[#66746b] hover:bg-[#f7f9f7]"}`}>
                <Icon size={17} /><span>{label}</span>{count !== undefined && <span className="hidden rounded-full bg-white px-2 py-0.5 text-[10px] lg:inline">{count}</span>}
              </button>
            ))}
            <Link href="/favorites" className="flex min-h-11 items-center justify-center gap-2 rounded-xl px-2 text-[10px] font-bold text-[#66746b] hover:bg-[#f7f9f7] lg:justify-start lg:px-3 lg:text-sm"><Heart size={17} /><span>{dashboardCopy.favorites}</span></Link>
          </nav>
          <Link href="/" className="mt-4 hidden items-center gap-2 px-3 text-xs font-semibold text-[#77847b] hover:text-[#176744] lg:flex"><ChevronLeft size={15} /> {dashboardCopy.back}</Link>
        </aside>

        <section className="min-w-0">
          <div className="mb-6">
            <p className="text-xs font-bold text-[#17734e]">{dashboardCopy.account}</p>
            <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">
              {section === "listings" ? dashboardCopy.listings : dashboardCopy.profile}
            </h1>
            <p className="mt-2 text-sm text-[#748078]">{dashboardCopy.heading}</p>
          </div>

          {(feedback.error || feedback.success) && (
            <div role={feedback.error ? "alert" : "status"} className={`mb-5 flex items-start gap-2 rounded-xl p-4 text-sm leading-6 ${feedback.error ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>
              {feedback.error ? <CircleAlert size={17} className="mt-1 shrink-0" /> : <Check size={17} className="mt-1 shrink-0" />}
              {feedback.error ?? feedback.success}
            </div>
          )}

          {section === "listings" && (
            <div className="space-y-4">
              <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-100 bg-gradient-to-l from-emerald-50 to-white p-4">
                <div>
                  <p className="text-sm font-extrabold">{proStore && Date.parse(proStore.until) > currentTime ? `متجر PRO: ${proStore.name}` : "وسّع حضور نشاطك بمتجر PRO"}</p>
                  <p className="mt-1 text-xs text-[#748078]">{proStore && Date.parse(proStore.until) > currentTime
                    ? `متبقي ${Math.max(1, Math.ceil((Date.parse(proStore.until) - currentTime) / 86_400_000))} يوم · ينتهي ${date.format(new Date(proStore.until))}`
                    : "واجهة متجر موثقة تجمع إعلاناتك في مكان واحد."}</p>
                </div>
                <Button type="button" size="small" onClick={() => setCheckoutTarget({ type: "pro_store" })}><ShieldCheck size={15} /> {proStore ? "تجديد اشتراك PRO" : "ترقية إلى متجر PRO"}</Button>
              </section>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e7eae7] bg-white p-4">
                <p className="text-sm text-[#65736b]">أدر الأسعار والوصف وحالة ظهور إعلاناتك.</p>
                <Link href="/list-an-item" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#17734e] px-4 text-xs font-bold text-white"><Plus size={15} /> إعلان جديد</Link>
              </div>
              {listings.length === 0 ? (
                <EmptyState icon={<LayoutDashboard size={22} />} title="ليس لديك إعلانات بعد" body="ابدأ بإضافة غرض أو خدمة ليتمكن الآخرون من استئجارها." action={<Link href="/list-an-item" className="font-bold text-[#176744]">نشر إعلانك الأول</Link>} />
              ) : listings.map((listing) => (
                <article key={listing.id} className="overflow-hidden rounded-2xl border border-[#e4eae5] bg-white">
                  <div className="grid sm:grid-cols-[180px_minmax(0,1fr)]">
                    <div className="relative min-h-36 bg-[#eef2ee]">
                      {listing.image && <Image src={listing.image} alt="" fill sizes="180px" className="object-cover" unoptimized />}
                      {!listing.image && <div className="flex h-full min-h-36 items-center justify-center text-[#a2afa5]"><LayoutDashboard size={27} /></div>}
                    </div>
                    <div className="min-w-0 p-4 sm:p-5">
                      {editingListing === listing.id ? (
                        <form onSubmit={(event) => saveListing(event, listing.id)} className="space-y-3">
                          <div><FieldLabel htmlFor={`title-${listing.id}`} required>عنوان الإعلان</FieldLabel><Input id={`title-${listing.id}`} name="title" required minLength={5} maxLength={100} defaultValue={listing.title} /></div>
                          <div><FieldLabel htmlFor={`description-${listing.id}`} required>الوصف</FieldLabel><Textarea id={`description-${listing.id}`} name="description" required minLength={20} maxLength={3000} defaultValue={listing.description} className="min-h-24" /></div>
                          <div><FieldLabel htmlFor={`price-${listing.id}`} required>السعر اليومي (دج)</FieldLabel><Input id={`price-${listing.id}`} name="pricePerDay" type="number" min={0} max={100000000} step="1" required defaultValue={listing.pricePerDay} dir="ltr" /></div>
                          <div className="flex gap-2">
                            <Button type="submit" size="small" disabled={busy === `listing:${listing.id}`}><Check size={15} /> حفظ</Button>
                            <Button type="button" variant="outline" size="small" onClick={() => setEditingListing(null)}>إلغاء</Button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold text-[#8a968e]">{listing.categoryName}</p>
                              <h2 className="mt-1 truncate text-base font-extrabold">{listing.title}{isListingFeatured(listing, currentTime) && <span className="ms-2 rounded-full bg-amber-50 px-2 py-1 align-middle text-[9px] text-amber-800">مميز | Featured</span>}</h2>
                              {isListingFeatured(listing, currentTime) && listing.featuredUntil && <p className="mt-1 text-[10px] font-semibold text-amber-800">متبقي {Math.max(1, Math.ceil((Date.parse(listing.featuredUntil) - currentTime) / 86_400_000))} يوم · ينتهي {date.format(new Date(listing.featuredUntil))}</p>}
                              <p className="mt-1 flex items-center gap-1 text-xs text-[#859188]"><MapPin size={13} /> {listing.commune} · ولاية {listing.wilaya}</p>
                            </div>
                            <StatusBadge status={listing.status} />
                          </div>
                          <p className="mt-3 line-clamp-2 text-xs leading-5 text-[#738078]">{listing.description}</p>
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#eef1ee] pt-3">
                            <p className="text-sm font-extrabold">{formatDzd(listing.pricePerDay)} <span className="text-[10px] font-medium text-[#849087]">/ يوم</span><span className="mx-2 text-[#d1d8d2]">·</span><span className="text-xs font-semibold text-[#8a6b2e]">الضمان {formatDzd(listing.cautionAmount)}</span></p>
                            <div className="flex gap-2">
                              {!isListingFeatured(listing, currentTime) && <Button type="button" variant="outline" size="small" onClick={() => setCheckoutTarget({ type: "featured", listingId: listing.id, listingTitle: listing.title })}><Star size={14} /> ترقية لمميز</Button>}
                              <Button type="button" variant="outline" size="small" onClick={() => setEditingListing(listing.id)}><Pencil size={14} /> تعديل</Button>
                              {listing.status !== "rented" && (
                                <Button type="button" variant="outline" size="small" disabled={busy === `status:${listing.id}`} onClick={() => void runAction(`status:${listing.id}`, () => setListingStatus(listing.id, listing.status === "active" ? "paused" : "active"))}>
                                  <Pause size={14} /> {listing.status === "active" ? "إيقاف" : "تفعيل"}
                                </Button>
                              )}
                              <Button type="button" variant="ghost" size="icon" aria-label="حذف الإعلان" disabled={busy === `delete:${listing.id}`} onClick={() => setDeletingListing(listing)}><Trash2 size={16} className="text-red-700" /></Button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {section === "profile" && (
            <div className="grid gap-5 xl:grid-cols-2">
              <section className="rounded-2xl border border-[#e4eae5] bg-white p-5 sm:p-6">
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#edf5ef] text-[#176744]"><UserRound size={19} /></span>
                  <div><h2 className="font-extrabold">معلومات الحساب</h2><p className="mt-1 text-xs text-[#859188]">حدّث بيانات التواصل ومكان الإقامة.</p></div>
                </div>
                <form onSubmit={saveProfile} className="space-y-4">
                  <div><FieldLabel htmlFor="profile-name" required>الاسم الكامل</FieldLabel><Input id="profile-name" name="fullName" required minLength={2} maxLength={100} defaultValue={profile.full_name} /></div>
                  <div><FieldLabel htmlFor="profile-phone">رقم الهاتف</FieldLabel><Input id="profile-phone" name="phoneNumber" type="tel" dir="ltr" placeholder="+213 555 123 456" maxLength={24} defaultValue={profile.phone_number ?? ""} /></div>
                  <div>
                    <FieldLabel htmlFor="profile-wilaya">الولاية</FieldLabel>
                    <Select id="profile-wilaya" name="wilaya" defaultValue={profile.wilaya ?? ""}>
                      <option value="">اختر الولاية</option>
                      {locations.map((location) => <option key={location.code} value={location.name.ar}>{location.name.ar}</option>)}
                    </Select>
                  </div>
                  <Button type="submit" disabled={busy === "profile"}>{busy === "profile" && <LoaderCircle size={16} className="animate-spin" />} حفظ الملف الشخصي</Button>
                </form>
              </section>

              <section className="rounded-2xl border border-[#e4eae5] bg-white p-5 sm:p-6">
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff6e7] text-[#987238]"><ShieldCheck size={19} /></span>
                  <div><h2 className="font-extrabold">توثيق الهوية</h2><p className="mt-1 text-xs text-[#859188]">أرسل وثيقة لإثبات الهوية ومساعدة المجتمع على الوثوق بحسابك.</p></div>
                </div>
                <div className={`rounded-xl p-4 text-sm leading-6 ${profile.identity_verified ? "bg-emerald-50 text-emerald-800" : latestIdentityStatus === "pending" ? "bg-amber-50 text-amber-900" : "bg-[#f5f7f5] text-[#69776e]"}`}>
                  {profile.identity_verified ? "تم توثيق هويتك." : latestIdentityStatus === "pending" ? "تم استلام وثيقتك وهي قيد المراجعة. لا يمكن تفعيل شارة التوثيق إلا بعد مراجعة إدارية." : latestIdentityStatus === "rejected" ? "لم تتم الموافقة على الوثيقة السابقة. يمكنك إرسال وثيقة واضحة جديدة." : "لم ترسل وثيقة للتحقق بعد."}
                </div>
                {!profile.identity_verified && !demoMode && (
                  <form onSubmit={uploadIdentity} className="mt-4 space-y-3">
                    <div>
                      <FieldLabel htmlFor="identity-document" required>بطاقة التعريف (JPG أو PNG أو PDF، حتى 8 MB)</FieldLabel>
                      <Input id="identity-document" name="identityDocument" type="file" accept="image/jpeg,image/png,application/pdf" required className="h-auto py-3 file:me-3 file:rounded-lg file:border-0 file:bg-[#edf5ef] file:px-3 file:py-2 file:text-xs file:font-bold file:text-[#176744]" />
                    </div>
                    <p className="text-xs leading-5 text-[#8a968e]">تُحفظ الوثيقة في مساحة خاصة ولا تُعرض في الملف العام. لا ترسل إلا الوثائق اللازمة للتحقق.</p>
                    <Button type="submit" variant="outline" disabled={busy === "identity"}>{busy === "identity" ? <LoaderCircle size={16} className="animate-spin" /> : <FileCheck2 size={16} />} إرسال للمراجعة</Button>
                  </form>
                )}
                <p className="mt-5 flex items-start gap-2 border-t border-[#edf0ed] pt-4 text-[11px] leading-5 text-[#829087]"><CircleAlert size={15} className="mt-0.5 shrink-0" /> يُرجى مراجعة سياسات الخصوصية والامتثال قبل استخدام رفع الهوية في بيئة الإنتاج.</p>
              </section>
            </div>
          )}
        </section>
      </div>
      {deletingListing && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-3 sm:items-center sm:p-6">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-listing-title"
            className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-3xl sm:p-6"
          >
            <h2 id="delete-listing-title" className="text-lg font-extrabold">حذف الإعلان؟</h2>
            <p className="mt-2 text-sm leading-6 text-[#69776e]">هل تريد حذف «{deletingListing.title}» نهائياً؟ لا يمكن التراجع عن هذا الإجراء.</p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setDeletingListing(null)}>إلغاء</Button>
              <Button
                type="button"
                variant="destructive"
                className="min-h-11"
                disabled={busy === `delete:${deletingListing.id}`}
                onClick={() => {
                  const id = deletingListing.id;
                  setDeletingListing(null);
                  void runAction(`delete:${id}`, () => removeListing(id));
                }}
              >
                <Trash2 size={15} /> حذف الإعلان
              </Button>
            </div>
          </section>
        </div>
      )}
      {checkoutTarget && <PromotionCheckout target={checkoutTarget} settings={paymentSettings} demoMode={demoMode} onClose={() => setCheckoutTarget(null)} />}
    </main>
  );
}

function StatusBadge({ status }: { status: ListingStatus | RentalStatus }) {
  const labels: Record<string, string> = {
    active: "نشط",
    paused: "متوقف مؤقتاً",
    rented: "مؤجّر",
    pending: "بانتظار الرد",
    approved: "مقبول",
    completed: "مكتمل",
    cancelled: "مرفوض / ملغي",
  };
  const styles: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-800",
    paused: "bg-amber-50 text-amber-900",
    rented: "bg-blue-50 text-blue-800",
    pending: "bg-amber-50 text-amber-900",
    approved: "bg-emerald-50 text-emerald-800",
    completed: "bg-blue-50 text-blue-800",
    cancelled: "bg-[#f1f3f1] text-[#68756c]",
  };
  return <span className={`rounded-full px-3 py-1.5 text-[10px] font-bold ${styles[status]}`}>{labels[status]}</span>;
}

function RequestGroup({
  title,
  description,
  requests,
  role,
  demoMode,
  currentUserId,
  busy,
  onDecision,
  onComplete,
  onHandover,
  onReview,
}: {
  title: string;
  description: string;
  requests: DashboardRequest[];
  role: "owner" | "renter";
  demoMode: boolean;
  currentUserId: string;
  busy: string;
  onDecision: (id: string, status: "approved" | "cancelled") => void;
  onComplete: (id: string) => void;
  onHandover: (formData: FormData, actingUserId: string) => void;
  onReview: (request: DashboardRequest, actingUserId: string) => void;
}) {
  const [expandedHandover, setExpandedHandover] = useState<string | null>(null);
  const actingUserId = currentUserId;

  return (
    <section className="rounded-2xl border border-[#e4eae5] bg-white p-4 sm:p-5">
      <div className="mb-4 border-b border-[#edf0ed] pb-4">
        <h2 className="font-extrabold">{title}</h2>
        <p className="mt-1 text-xs text-[#859188]">{description}</p>
      </div>
      {requests.length === 0 ? (
        <div className="py-8 text-center">
          <CalendarDays size={24} className="mx-auto text-[#b2bcb4]" />
          <p className="mt-3 text-sm font-bold text-[#68756c]">لا توجد طلبات هنا حالياً</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <article key={request.id} className="rounded-xl border border-[#edf0ed] p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-extrabold">{request.listingTitle}</h3>
                  <p className="mt-1 text-[11px] text-[#8a968e]">{role === "owner" ? "طلب من مستأجر" : "طلب إلى مالك الإعلان"}</p>
                </div>
                <StatusBadge status={request.status} />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-[#f7f9f7] p-3 text-[11px]">
                <div><span className="block text-[#8a968e]">من — إلى</span><strong className="mt-1 block">{displayDate(request.startDate)} — {displayDate(request.endDate)}</strong></div>
                <div><span className="block text-[#8a968e]">الإجمالي</span><strong className="mt-1 block">{formatDzd(request.totalPrice)}</strong></div>
                {request.cautionAmount > 0 && <div className="col-span-2 flex items-center gap-1 text-[#87692f]"><Wallet size={13} /> الضمان: {formatDzd(request.cautionAmount)}</div>}
              </div>
              {role === "owner" && request.renterReliability && (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-[10px] font-bold text-emerald-800">
                  <ShieldCheck size={14} />
                  <span>أكمل {request.renterReliability.completedRentals} عمليات كراء بنجاح</span>
                  {request.renterReliability.verified && <span>· هوية موثّقة</span>}
                  <span>· التقييم {request.renterReliability.rating.toFixed(1)} ★</span>
                </div>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {role === "owner" && request.status === "pending" && (
                  <>
                    <Button type="button" size="small" disabled={busy === `request:${request.id}`} onClick={() => onDecision(request.id, "approved")}><Check size={14} /> قبول الطلب</Button>
                    <Button type="button" size="small" variant="outline" disabled={busy === `request:${request.id}`} onClick={() => onDecision(request.id, "cancelled")}><X size={14} /> رفض</Button>
                  </>
                )}
                {role === "renter" && ["pending", "approved"].includes(request.status) && (
                  <Button type="button" size="small" variant="outline" disabled={busy === `request:${request.id}`} onClick={() => onDecision(request.id, "cancelled")}><X size={14} /> إلغاء الطلب</Button>
                )}
                {["approved", "active", "completed"].includes(request.status) && (
                  <Link href={`/dashboard/contracts/${request.id}`} className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-[#cde3d3] bg-[#f0f8f2] px-3 text-xs font-bold text-[#176744] hover:bg-[#e4f2e8]">
                    <FileText size={14} /> إنشاء / طباعة العقد
                  </Link>
                )}
                {["approved", "active", "completed"].includes(request.status) && (
                  <button type="button" onClick={() => setExpandedHandover(expandedHandover === request.id ? null : request.id)} className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-[#e0e7e1] px-3 text-xs font-bold text-[#526159]">
                    <FileCheck2 size={14} /> توثيق الاستلام والإرجاع
                  </button>
                )}
                {role === "owner" && request.status === "active" && (
                  <button type="button" disabled={busy === `complete:${request.id}`} onClick={() => onComplete(request.id)} className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-800 disabled:opacity-50">
                    <Check size={14} /> إكمال الكراء
                  </button>
                )}
                {request.status === "completed" && !request.userHasReviewed && (
                  <button type="button" onClick={() => onReview(request, actingUserId)} className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 text-xs font-bold text-amber-900">
                    <Star size={14} /> قيّم الطرف الآخر
                  </button>
                )}
                <ReportDisputeModal listingId={request.listingId} requestId={request.id} targetUserId={role === "owner" ? request.renterId : request.ownerId} demoMode={demoMode} />
              </div>
              {expandedHandover === request.id && (
                <HandoverPanel
                  request={request}
                  currentUserId={actingUserId}
                  busy={busy === `handover:${request.id}`}
                  onSubmit={(formData) => onHandover(formData, actingUserId)}
                />
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function HandoverPanel({
  request,
  currentUserId,
  busy,
  onSubmit,
}: {
  request: DashboardRequest;
  currentUserId: string;
  busy: boolean;
  onSubmit: (formData: FormData) => void;
}) {
  const phases = [
    { id: "check_in" as const, label: "استلام الغرض قبل الكراء", allowed: ["approved", "active"].includes(request.status) },
    { id: "check_out" as const, label: "إرجاع الغرض بعد الكراء", allowed: ["active", "completed"].includes(request.status) },
  ];
  return (
    <section className="mt-4 space-y-3 border-t border-[#edf0ed] pt-4">
      <p className="text-[11px] leading-5 text-[#6f7d74]">وثّق حالة الغرض والملاحظات والصور. يجب أن يوثّق الطرفان الإرجاع قبل ردّ مبلغ الضمان.</p>
      {phases.map((phase) => {
        const logs = request.handoverLogs.filter((log) => log.phase === phase.id);
        const ownLog = logs.find((log) => log.userId === currentUserId);
        return (
          <div key={phase.id} className="rounded-xl bg-[#f8faf8] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-extrabold">{phase.label}</h4>
              <span className="text-[10px] text-[#829087]">{logs.length}/2 طرف وثّق الحالة</span>
            </div>
            {logs.map((log) => (
              <div key={log.id} className="mt-2 rounded-lg border border-[#e8ede8] bg-white p-3">
                <p className="text-[10px] font-bold text-[#176744]">{log.userId === currentUserId ? "توثيقك" : "توثيق الطرف الآخر"}</p>
                <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-[#526159]">{log.notes}</p>
                {log.photoUrls.map((url) => <a key={url} href={url} target="_blank" rel="noreferrer" className="mt-2 inline-block"><img src={url} alt="صورة حالة الغرض" className="max-h-32 rounded-lg object-cover" /></a>)}
              </div>
            ))}
            {phase.allowed && !ownLog && (
              <form action={onSubmit} className="mt-3 space-y-2">
                <input type="hidden" name="requestId" value={request.id} />
                <input type="hidden" name="phase" value={phase.id} />
                <label className="block text-[10px] font-bold">ملاحظات حالة الغرض<textarea name="notes" required minLength={3} maxLength={2000} rows={2} className="mt-1 w-full rounded-lg border border-[#dfe6e0] bg-white p-2 text-xs" placeholder="اكتب وصف الحالة أو أي ضرر ظاهر" /></label>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" className="max-w-full text-[10px]" />
                  <button type="submit" disabled={busy} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#17734e] px-3 text-[10px] font-bold text-white disabled:opacity-50">{busy && <LoaderCircle size={13} className="animate-spin" />}حفظ التوثيق</button>
                </div>
              </form>
            )}
          </div>
        );
      })}
    </section>
  );
}

function EmptyState({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#dfe6e0] bg-white px-5 py-12 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eef4ef] text-[#6e8d76]">{icon}</span>
      <h2 className="mt-4 font-extrabold">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[#829087]">{body}</p>
      {action && <div className="mt-4 text-sm">{action}</div>}
    </div>
  );
}
