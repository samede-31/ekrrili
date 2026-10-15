"use client";

import {
  BadgeCheck,
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  ClipboardList,
  Copy,
  FileCheck2,
  FileText,
  LayoutDashboard,
  ListFilter,
  LoaderCircle,
  LogOut,
  Menu,
  Pause,
  Pencil,
  Play,
  Search,
  ShieldCheck,
  Star,
  Store,
  Trash2,
  UserRound,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { moderateListing, reviewDisputeReport, reviewIdentityDocument, reviewListingPromotion, reviewProStoreApplication, saveAdminPromotionSettings, setAdminProStoreExpiry, setAdminUserFlag, updateAdminCategory } from "@/features/admin/admin-actions";
import { getLocalMarketplace, reviewLocalProStoreApplication, reviewLocalPromotion, saveLocalMarketplace, saveLocalPromotionSettings, setLocalProStoreExpiry } from "@/features/listings/local-marketplace";
import { defaultPromotionPaymentSettings, type PromotionPaymentSettings } from "@/features/promotions/promotion-settings";

export type AdminProfile = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  wilaya: string;
  verified: boolean;
  suspended: boolean;
  role: string;
  isProStore?: boolean;
  storeName?: string | null;
  storeSlug?: string | null;
  proUntil?: string | null;
};

export type AdminDashboardData = {
  demoMode: boolean;
  profiles: AdminProfile[];
  documents: Array<{
    id: string;
    userId: string;
    fullName: string;
    phone: string;
    status: string;
    submittedAt: string;
    signedUrl: string | null;
    previewError?: string | null;
    rejectionNote: string | null;
  }>;
  listings: Array<{
    id: string;
    title: string;
    ownerId: string;
    ownerName: string;
    categoryName: string;
    price: number;
    status: string;
    featured: boolean;
    featuredUntil: string | null;
    image: string | null;
    createdAt: string;
  }>;
  rentals: Array<{
    id: string;
    listingId: string;
    listingTitle: string;
    ownerName: string;
    renterName: string;
    startDate: string;
    endDate: string;
    status: string;
    totalPrice: number;
  }>;
  categories: Array<{
    id: string;
    slug: string;
    nameAr: string;
    nameFr: string;
    dynamicSchema: unknown;
  }>;
  promotions: Array<{
    id: string;
    listingId: string;
    listingTitle: string;
    ownerName: string;
    receiptUrl: string | null;
    status: string;
    submittedAt: string;
    rejectionNote: string | null;
    planId: string;
    durationDays: number;
    amountDzd: number;
    amountUsd: number;
    currency: "DZD" | "USD";
    paymentMethod: "baridimob" | "ccp" | "bybit";
    paymentReference: string;
    senderInfo: string;
  }>;
  disputes: Array<{
    id: string;
    reporterId: string;
    reporterName: string;
    targetUserId: string | null;
    listingId: string | null;
    listingTitle: string;
    requestId: string | null;
    reason: string;
    details: string;
    status: string;
    createdAt: string;
    handoverLogs: Array<{ userName: string; phase: string; notes: string; createdAt: string; photoUrls: string[] }>;
  }>;
  proStoreApplications: Array<{
    id: string;
    ownerId: string;
    ownerName: string;
    storeName: string;
    slug: string;
    bio: string;
    businessHours: Record<string, string>;
    wilaya: string;
    paymentReference: string;
    planId: string;
    proDays: number;
    currency: "DZD" | "USD";
    amountDzd: number;
    amountUsd: number;
    paymentMethod: "baridimob" | "ccp" | "bybit";
    senderInfo: string;
    status: string;
    submittedAt: string;
    receiptUrl: string | null;
  }>;
  proStores: Array<{ ownerId: string; ownerName: string; storeName: string; slug: string; proUntil: string }>;
  paymentSettings: PromotionPaymentSettings;
};

const storageKey = "ekrrili-admin-demo-v1";
const sections = [
  { id: "overview", label: "نظرة عامة", icon: LayoutDashboard },
  { id: "kyc", label: "توثيق الهويات", icon: FileCheck2 },
  { id: "listings", label: "إدارة الإعلانات", icon: ClipboardList },
  { id: "users", label: "إدارة المستخدمين", icon: UsersRound },
  { id: "disputes", label: "النزاعات والبلاغات", icon: AlertTriangle },
  { id: "promotions", label: "طلبات التمييز والاشتراكات", icon: Star },
  { id: "pro-stores", label: "متاجر PRO", icon: Store },
  { id: "payment-settings", label: "إعدادات الدفع والباقات", icon: Wallet },
  { id: "categories", label: "التصنيفات", icon: ListFilter },
] as const;
type SectionId = (typeof sections)[number]["id"] | "rentals";

const formatMoney = (amount: number) => `${new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 0 }).format(amount)} د.ج`;
const statusLabels: Record<string, string> = {
  active: "نشط",
  paused: "متوقف",
  rented: "مؤجّر",
  pending: "قيد الانتظار",
  approved: "مقبول",
  completed: "مكتمل",
  cancelled: "ملغي",
};

function DemoIdPreview() {
  return (
    <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-[#cbd8ce] bg-[#f1f6f2] p-4">
      <div className="w-full max-w-xs rounded-xl border border-[#cddbd0] bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between border-b border-[#edf1ed] pb-2 text-[9px] font-extrabold text-[#176744]">
          <span>الجمهورية الجزائرية الديمقراطية الشعبية</span><span>نموذج توضيحي</span>
        </div>
        <div className="flex gap-3 pt-3">
          <div className="flex h-20 w-16 shrink-0 items-center justify-center rounded-lg bg-[#e7eee9] text-[#75847a]"><UserRound size={28} /></div>
          <div className="flex-1 space-y-2 pt-1">
            <div className="h-2 w-4/5 rounded bg-[#dce6de]" />
            <div className="h-2 w-3/5 rounded bg-[#e8eee9]" />
            <div className="h-2 w-2/3 rounded bg-[#e8eee9]" />
            <p className="pt-1 text-[9px] font-bold text-[#87938a]">معاينة تعليمية — ليست وثيقة حقيقية</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, detail, icon: Icon, tint }: {
  label: string;
  value: number;
  detail: string;
  icon: typeof UsersRound;
  tint: string;
}) {
  return (
    <article className="rounded-2xl border border-[#e4eae5] bg-white p-5 shadow-[0_3px_14px_rgba(27,53,35,0.03)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-[#748078]">{label}</p>
          <p className="mt-3 text-3xl font-extrabold tracking-tight text-[#17231d]">{value.toLocaleString("fr-DZ")}</p>
        </div>
        <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${tint}`}><Icon size={20} /></span>
      </div>
      <p className="mt-3 text-[11px] text-[#829087]">{detail}</p>
    </article>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-[#dce5de] bg-[#fafcfa] px-5 py-12 text-center text-sm text-[#7a887e]">{children}</div>;
}

export function AdminDashboard({ initialData }: { initialData: AdminDashboardData }) {
  const [data, setData] = useState(initialData);
  const [section, setSection] = useState<SectionId>("overview");
  const [search, setSearch] = useState("");
  const [listingStatus, setListingStatus] = useState("all");
  const [feedback, setFeedback] = useState<{ success?: string; error?: string }>({});
  const [busy, setBusy] = useState("");
  const [rejectingId, setRejectingId] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [categoryJson, setCategoryJson] = useState("");
  const [promotionRejectId, setPromotionRejectId] = useState("");
  const [promotionRejectNote, setPromotionRejectNote] = useState("");
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [storeExpiryDrafts, setStoreExpiryDrafts] = useState<Record<string, string>>({});
  const [promoCodeDraft, setPromoCodeDraft] = useState("");
  const [promoDaysDraft, setPromoDaysDraft] = useState<7 | 14>(7);
  const [promoLimitDraft, setPromoLimitDraft] = useState("");
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const isListingFeatured = (listing: AdminDashboardData["listings"][number]) =>
    Boolean(listing.featured && listing.featuredUntil && Date.parse(listing.featuredUntil) > currentTime);

  const copyPaymentReference = async (reference: string) => {
    if (!reference) return;
    try {
      await navigator.clipboard.writeText(reference);
      setFeedback({ success: "تم نسخ رقم العملية." });
    } catch (caught) {
      setFeedback({ error: caught instanceof Error ? `تعذر النسخ: ${caught.message}` : "تعذر نسخ رقم العملية." });
    }
  };

  useEffect(() => {
    if (!initialData.demoMode) return;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed === "object" && parsed !== null && "profiles" in parsed && "documents" in parsed && "categories" in parsed) {
          const saved = parsed as AdminDashboardData;
          setData((current) => ({ ...current, ...saved, demoMode: true }));
        }
      }
      const market = getLocalMarketplace();
      setData((current) => ({
        ...current,
        listings: market.listings.map((listing) => ({
          id: listing.id,
          title: listing.title.ar,
          ownerId: listing.ownerId,
          ownerName: listing.owner.ar,
          categoryName: listing.category,
          price: listing.price,
          status: listing.status,
          featured: Boolean("featured" in listing && listing.featured),
          featuredUntil: listing.featuredUntil ?? null,
          image: listing.images[0] ?? null,
          createdAt: listing.createdAt,
        })),
        promotions: (market.promotions ?? []).map((promotion) => ({
          id: promotion.id,
          listingId: promotion.listingId,
          listingTitle: market.listings.find((listing) => listing.id === promotion.listingId)?.title.ar ?? "إعلان",
          ownerName: market.listings.find((listing) => listing.id === promotion.listingId)?.owner.ar ?? "عضو",
          receiptUrl: promotion.receiptDataUrl,
          status: promotion.status,
          submittedAt: promotion.createdAt,
          rejectionNote: null,
          planId: promotion.planId,
          durationDays: promotion.durationDays,
          amountDzd: promotion.amountDzd ?? 0,
          amountUsd: promotion.amountUsd ?? 0,
          currency: promotion.currency === "USD" ? "USD" : "DZD",
          paymentMethod: promotion.paymentMethod,
          paymentReference: promotion.paymentReference,
          senderInfo: promotion.senderInfo,
        })),
        disputes: (market.disputeReports ?? []).map((report) => ({
          id: report.id,
          reporterId: report.reporterId,
          reporterName: "عضو تجريبي",
          targetUserId: report.targetUserId ?? null,
          listingId: report.listingId ?? null,
          listingTitle: market.listings.find((listing) => listing.id === report.listingId)?.title.ar ?? "إعلان",
          requestId: report.requestId ?? null,
          reason: report.reason,
          details: report.details,
          status: report.status,
          createdAt: report.createdAt,
          handoverLogs: [],
        })),
        proStoreApplications: (market.proStoreApplications ?? []).map((application) => ({
          id: application.id,
          ownerId: application.ownerId,
          ownerName: market.profile?.fullName ?? "عضو تجريبي",
          storeName: application.storeName,
          slug: application.slug,
          bio: application.bio,
          businessHours: application.businessHours,
          wilaya: application.wilaya,
          paymentReference: application.paymentReference,
          planId: application.planId ?? "",
          proDays: application.proDays,
          currency: application.currency === "USD" ? "USD" : "DZD",
          amountDzd: application.amountDzd ?? 0,
          amountUsd: application.amountUsd ?? 0,
          paymentMethod: application.paymentMethod ?? "baridimob",
          senderInfo: application.senderInfo ?? "",
          status: application.status,
          submittedAt: application.createdAt,
          receiptUrl: application.receiptDataUrl,
        })),
        proStores: (market.proStores ?? []).map((store) => ({
          ownerId: store.ownerId, ownerName: market.profile?.fullName ?? "عضو تجريبي",
          storeName: store.storeName, slug: store.slug, proUntil: store.proUntil,
        })),
        paymentSettings: market.promotionSettings ?? defaultPromotionPaymentSettings,
      }));
    } catch (caught) {
      setFeedback({ error: caught instanceof Error ? caught.message : "تعذرت قراءة بيانات العرض المحلية." });
    }
  }, [initialData.demoMode]);

  useEffect(() => {
    if (!data.demoMode) return;
    const refresh = () => {
      const market = getLocalMarketplace();
      setData((current) => ({
        ...current,
        disputes: (market.disputeReports ?? []).map((report) => ({
          id: report.id, reporterId: report.reporterId, reporterName: "عضو تجريبي",
          targetUserId: report.targetUserId ?? null, listingId: report.listingId ?? null,
          listingTitle: market.listings.find((listing) => listing.id === report.listingId)?.title.ar ?? "إعلان",
          requestId: report.requestId ?? null, reason: report.reason, details: report.details,
          status: report.status, createdAt: report.createdAt, handoverLogs: [],
        })),
        proStoreApplications: (market.proStoreApplications ?? []).map((application) => ({
          id: application.id, ownerId: application.ownerId, ownerName: market.profile?.fullName ?? "عضو تجريبي",
          storeName: application.storeName, slug: application.slug, bio: application.bio, wilaya: application.wilaya,
          businessHours: application.businessHours,
          paymentReference: application.paymentReference, proDays: application.proDays, status: application.status,
          planId: application.planId ?? "",
          currency: application.currency === "USD" ? "USD" : "DZD",
          amountDzd: application.amountDzd ?? 0,
          amountUsd: application.amountUsd ?? 0,
          paymentMethod: application.paymentMethod ?? "baridimob",
          senderInfo: application.senderInfo ?? "",
          submittedAt: application.createdAt, receiptUrl: application.receiptDataUrl,
        })),
        proStores: (market.proStores ?? []).map((store) => ({
          ownerId: store.ownerId, ownerName: market.profile?.fullName ?? "عضو تجريبي",
          storeName: store.storeName, slug: store.slug, proUntil: store.proUntil,
        })),
        listings: market.listings.map((listing) => ({
          id: listing.id, title: listing.title.ar, ownerId: listing.ownerId, ownerName: listing.owner.ar,
          categoryName: listing.category, price: listing.price, status: listing.status,
          featured: Boolean(listing.featured && listing.featuredUntil && Date.parse(listing.featuredUntil) > Date.now()),
          featuredUntil: listing.featuredUntil ?? null, image: listing.images[0] ?? null, createdAt: listing.createdAt,
        })),
        promotions: (market.promotions ?? []).map((promotion) => ({
          id: promotion.id, listingId: promotion.listingId,
          listingTitle: market.listings.find((listing) => listing.id === promotion.listingId)?.title.ar ?? "إعلان",
          ownerName: market.profile?.fullName ?? "عضو تجريبي", receiptUrl: promotion.receiptDataUrl,
          status: promotion.status, submittedAt: promotion.createdAt, rejectionNote: null,
          planId: promotion.planId, durationDays: promotion.durationDays, amountDzd: promotion.amountDzd ?? 0,
          amountUsd: promotion.amountUsd ?? 0, currency: promotion.currency,
          paymentMethod: promotion.paymentMethod, paymentReference: promotion.paymentReference, senderInfo: promotion.senderInfo,
        })),
        paymentSettings: market.promotionSettings ?? defaultPromotionPaymentSettings,
      }));
    };
    window.addEventListener("ekrrili-local-marketplace-change", refresh);
    return () => window.removeEventListener("ekrrili-local-marketplace-change", refresh);
  }, [data.demoMode]);

  useEffect(() => {
    if (!data.demoMode) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({
        profiles: data.profiles,
        documents: data.documents,
        categories: data.categories,
      }));
    } catch (caught) {
      setFeedback({ error: caught instanceof Error ? caught.message : "تعذر حفظ بيانات العرض المحلية." });
    }
  }, [data.demoMode, data.profiles, data.documents, data.categories]);

  const pendingDocuments = data.documents.filter((document) => document.status === "pending");
  const activeListings = data.listings.filter((listing) => listing.status === "active").length;
  const openDisputes = data.disputes.filter((report) => ["pending", "reviewing"].includes(report.status)).length;

  const visibleListings = useMemo(() => data.listings.filter((listing) =>
    (listingStatus === "all" || listing.status === listingStatus) &&
    `${listing.title} ${listing.ownerName} ${listing.categoryName}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  ), [data.listings, listingStatus, search]);
  const visibleProfiles = useMemo(() => data.profiles.filter((profile) =>
    `${profile.fullName} ${profile.email} ${profile.phone} ${profile.wilaya}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  ), [data.profiles, search]);

  const execute = async (key: string, action: () => Promise<{ success?: string; error?: string }>) => {
    setBusy(key);
    setFeedback({});
    let result: { success?: string; error?: string };
    try {
      result = await action();
    } catch (caught) {
      result = { error: caught instanceof Error ? caught.message : "تعذر إكمال الإجراء." };
    }
    setFeedback(result);
    setBusy("");
    if (result.success && !data.demoMode) router.refresh();
  };

  const updateUserFlag = (profileId: string, flag: "verified" | "suspended", value: boolean) => {
    const serverFlag = flag === "verified" ? "identity_verified" : "is_suspended";
    return execute(`${profileId}-${flag}`, async () => {
      if (data.demoMode) {
        setData((current) => ({
          ...current,
          profiles: current.profiles.map((profile) => profile.id === profileId
            ? { ...profile, [flag]: value }
            : profile),
        }));
        return { success: "تم تحديث إعدادات المستخدم في هذا المتصفح." };
      }
      return setAdminUserFlag(profileId, serverFlag, value);
    });
  };

  const reviewDocument = (documentId: string, decision: "approved" | "rejected", note = "") =>
    execute(`${documentId}-${decision}`, async () => {
      if (data.demoMode) {
        const target = data.documents.find((document) => document.id === documentId);
        if (!target || target.status !== "pending") return { error: "لم يعد الطلب بانتظار المراجعة." };
        setData((current) => ({
          ...current,
          documents: current.documents.map((document) => document.id === documentId
            ? { ...document, status: decision, rejectionNote: decision === "rejected" ? note : null }
            : document),
          profiles: current.profiles.map((profile) => profile.id === target.userId
            ? { ...profile, verified: decision === "approved" }
            : profile),
        }));
        setRejectingId("");
        setRejectNote("");
        return { success: decision === "approved" ? "تم توثيق الهوية في الوضع التجريبي." : "تم رفض الطلب في الوضع التجريبي." };
      }
      const result = await reviewIdentityDocument(documentId, decision, note);
      if (result.success) {
        setData((current) => ({
          ...current,
          documents: current.documents.map((document) => document.id === documentId
            ? { ...document, status: decision, rejectionNote: decision === "rejected" ? note : null }
            : document),
          profiles: current.profiles.map((profile) => profile.id === current.documents.find((item) => item.id === documentId)?.userId
            ? { ...profile, verified: decision === "approved" }
            : profile),
        }));
      }
      return result;
    });

  const changeListing = (listingId: string, action: "feature" | "unfeature" | "pause" | "activate" | "delete") =>
    execute(`${listingId}-${action}`, async () => {
      if (data.demoMode) {
        const marketplace = getLocalMarketplace();
        if (action === "delete" && marketplace.requests.some((request) => request.listingId === listingId)) {
          return { error: "لا يمكن حذف إعلان مرتبط بطلب كراء محفوظ؛ أوقفه مؤقتاً." };
        }
        const listings = marketplace.listings.filter((item) => !(action === "delete" && item.id === listingId));
        const updated = listings.map((item) => item.id !== listingId
          ? item
          : {
            ...item,
            ...(action === "feature" ? { featured: true, featuredUntil: new Date(Date.now() + 30 * 86_400_000).toISOString() } : {}),
            ...(action === "unfeature" ? { featured: false, featuredUntil: null } : {}),
            ...(action === "pause" ? { status: "paused" as const } : {}),
            ...(action === "activate" ? { status: "active" as const } : {}),
          });

        saveLocalMarketplace({ ...marketplace, listings: updated });
        setData((current) => ({
          ...current,
          listings: action === "delete"
            ? current.listings.filter((listing) => listing.id !== listingId)
            : current.listings.map((listing) => listing.id !== listingId ? listing : {
              ...listing,
              ...(action === "feature" ? { featured: true, featuredUntil: new Date(Date.now() + 30 * 86_400_000).toISOString() } : {}),
              ...(action === "unfeature" ? { featured: false, featuredUntil: null } : {}),
              ...(action === "pause" ? { status: "paused" } : {}),
              ...(action === "activate" ? { status: "active" } : {}),
            }),
        }));
        return { success: "تم تحديث الإعلان في بيانات هذا المتصفح." };
      }
      return moderateListing(listingId, action);
    });

  const reviewPromotion = (promotionId: string, decision: "approved" | "rejected", note = "") =>
    execute(`promotion-${promotionId}`, async () => {
      if (data.demoMode) {
        reviewLocalPromotion(promotionId, decision);
        const promotedListingId = data.promotions.find((entry) => entry.id === promotionId)?.listingId;
        const localMarketplace = getLocalMarketplace();
        const affectedListing = localMarketplace.listings.find((listing) => listing.id === promotedListingId);
        setData((current) => ({
          ...current,
          promotions: current.promotions.map((item) => item.id === promotionId ? { ...item, status: decision, rejectionNote: decision === "rejected" ? note : null } : item),
          listings: current.listings.map((item) => item.id === current.promotions.find((entry) => entry.id === promotionId)?.listingId
            ? { ...item, featured: Boolean(affectedListing?.featured), featuredUntil: affectedListing?.featuredUntil ?? null }
            : item),
        }));
        setPromotionRejectId("");
        setPromotionRejectNote("");
        return { success: decision === "approved" ? "تم تفعيل التمييز في الوضع التجريبي." : "تم رفض طلب التمييز." };
      }
      const result = await reviewListingPromotion(promotionId, decision, note);
      if (result.success) {
        const reviewedPromotion = data.promotions.find((item) => item.id === promotionId);
        const featuredUntil = decision === "approved" && reviewedPromotion
          ? new Date(Date.now() + reviewedPromotion.durationDays * 86_400_000).toISOString()
          : null;
        setData((current) => ({
          ...current,
          promotions: current.promotions.map((item) => item.id === promotionId ? { ...item, status: decision, rejectionNote: decision === "rejected" ? note : null } : item),
          listings: current.listings.map((item) => item.id === current.promotions.find((entry) => entry.id === promotionId)?.listingId
            ? { ...item, featured: decision === "approved", featuredUntil }
            : item),
        }));
        setPromotionRejectId("");
        setPromotionRejectNote("");
      }
      return result;
    });

  const resolveDispute = (reportId: string, decision: "reviewing" | "resolved" | "dismissed") =>
    execute(`dispute-${reportId}`, async () => {
      if (data.demoMode) {
        const state = getLocalMarketplace();
        saveLocalMarketplace({
          ...state,
          disputeReports: (state.disputeReports ?? []).map((report) => report.id === reportId ? { ...report, status: decision } : report),
        });
        setData((current) => ({
          ...current,
          disputes: current.disputes.map((report) => report.id === reportId ? { ...report, status: decision } : report),
        }));
        return { success: "تم تحديث البلاغ محلياً." };
      }
      const result = await reviewDisputeReport(reportId, decision);
      if (result.success) setData((current) => ({ ...current, disputes: current.disputes.map((report) => report.id === reportId ? { ...report, status: decision } : report) }));
      return result;
    });

  const decideProStore = (applicationId: string, decision: "approved" | "rejected") =>
    execute(`pro-store-${applicationId}`, async () => {
      if (data.demoMode) {
        reviewLocalProStoreApplication(applicationId, decision);
        setData((current) => ({
          ...current,
          proStoreApplications: current.proStoreApplications.map((item) => item.id === applicationId ? { ...item, status: decision } : item),
          proStores: decision === "approved"
            ? (getLocalMarketplace().proStores ?? []).map((store) => ({
              ownerId: store.ownerId,
              ownerName: getLocalMarketplace().profile?.fullName ?? "عضو تجريبي",
              storeName: store.storeName,
              slug: store.slug,
              proUntil: store.proUntil,
            }))
            : current.proStores,
        }));
        return { success: decision === "approved" ? "تم اعتماد المتجر محلياً." : "تم رفض طلب المتجر." };
      }
      return reviewProStoreApplication(applicationId, decision);
    });

  const updateStoreExpiry = (profileId: string) => execute(`store-expiry-${profileId}`, async () => {
    const expiresOn = storeExpiryDrafts[profileId];
    if (!expiresOn) return { error: "اختر تاريخ انتهاء للمتجر." };
    if (data.demoMode) {
      try {
        setLocalProStoreExpiry(profileId, expiresOn);
        setData((current) => ({
          ...current,
          proStores: current.proStores.map((store) => store.ownerId === profileId
            ? { ...store, proUntil: new Date(`${expiresOn}T23:59:59.999Z`).toISOString() }
            : store),
        }));
        return { success: "تم تحديث تاريخ انتهاء المتجر محلياً." };
      } catch (caught) {
        return { error: caught instanceof Error ? caught.message : "تعذر تحديث المتجر." };
      }
    }
    const result = await setAdminProStoreExpiry(profileId, expiresOn);
    if (result.success) setData((current) => ({
      ...current,
      profiles: current.profiles.map((profile) => profile.id === profileId ? {
        ...profile, isProStore: true, proUntil: new Date(`${expiresOn}T23:59:59.999Z`).toISOString(),
      } : profile),
    }));
    return result;
  });
  const savePaymentSettings = () => execute("payment-settings", async () => {
    if (data.demoMode) {
      try {
        saveLocalPromotionSettings(data.paymentSettings);
        return { success: "تم حفظ إعدادات الدفع والباقات محلياً في هذا المتصفح." };
      } catch (caught) {
        return { error: caught instanceof Error ? caught.message : "تعذر حفظ الإعدادات." };
      }
    }
    return saveAdminPromotionSettings(data.paymentSettings);
  });

  const updatePaymentSetting = (key: "ccp_account_number" | "ccp_key" | "baridimob_rip" | "account_holder_name" | "support_phone" | "bybit_uid" | "bybit_pay_qr_url" | "usdt_wallet_address", value: string) => {
    setData((current) => ({ ...current, paymentSettings: { ...current.paymentSettings, [key]: value } }));
  };

  const updatePromotionPlan = (planId: string, field: "name" | "duration_days" | "amount_dzd" | "amount_usd" | "enabled", value: string | number | boolean) => {
    setData((current) => ({
      ...current,
      paymentSettings: {
        ...current.paymentSettings,
        promotion_plans: current.paymentSettings.promotion_plans.map((plan) =>
          plan.id !== planId ? plan : { ...plan, [field]: value },
        ),
      },
    }));
  };

  const addPromoCode = () => {
    const code = promoCodeDraft.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
      setFeedback({ error: "أدخل رمزاً من 3 إلى 32 حرفاً أو رقماً." });
      return;
    }
    if (data.paymentSettings.promo_codes.some((promo) => promo.code === code)) {
      setFeedback({ error: "هذا الرمز موجود بالفعل." });
      return;
    }
    const maxUses = promoLimitDraft.trim() ? Number(promoLimitDraft) : null;
    if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) {
      setFeedback({ error: "عدد الاستخدامات يجب أن يكون عدداً صحيحاً موجباً." });
      return;
    }
    setData((current) => ({
      ...current,
      paymentSettings: {
        ...current.paymentSettings,
        promo_codes: [...current.paymentSettings.promo_codes, {
          code,
          duration_days: promoDaysDraft,
          active: true,
          max_uses: maxUses,
          redeemed_count: 0,
          redeemed_by: [],
        }],
      },
    }));
    setPromoCodeDraft("");
    setPromoLimitDraft("");
    setFeedback({});
  };

  const saveCategory = (event: FormEvent<HTMLFormElement>, categoryId: string) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nameAr = String(form.get("nameAr") ?? "");
    const nameFr = String(form.get("nameFr") ?? "");
    void execute(`category-${categoryId}`, async () => {
      if (data.demoMode) {
        let dynamicSchema: unknown;
        try {
          dynamicSchema = JSON.parse(categoryJson);
          if (typeof dynamicSchema !== "object" || dynamicSchema === null || Array.isArray(dynamicSchema)) throw new Error();
        } catch {
          return { error: "صيغة JSON للحقول الديناميكية غير صالحة." };
        }
        setData((current) => ({
          ...current,
          categories: current.categories.map((category) => category.id === categoryId
            ? { ...category, nameAr, nameFr, dynamicSchema }
            : category),
        }));
        setEditingCategory(null);
        return { success: "تم حفظ التصنيف محلياً." };
      }
      const result = await updateAdminCategory(categoryId, nameAr, nameFr, categoryJson);
      if (result.success) {
        const dynamicSchema = JSON.parse(categoryJson) as unknown;
        setData((current) => ({
          ...current,
          categories: current.categories.map((category) => category.id === categoryId
            ? { ...category, nameAr, nameFr, dynamicSchema }
            : category),
        }));
        setEditingCategory(null);
      }
      return result;
    });
  };

  const title = sections.find((item) => item.id === section)?.label ?? "نظرة عامة";
  const nav = (compact = false) => (
    <nav aria-label="أقسام لوحة الإدارة" className={compact ? "grid grid-cols-4" : "space-y-1"}>
      {sections.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => { setSection(id); setSearch(""); setFeedback({}); }}
          aria-current={section === id ? "page" : undefined}
          className={compact
            ? `flex min-h-[62px] flex-col items-center justify-center gap-1 px-1 text-[9px] font-bold ${section === id ? "text-[#176744]" : "text-[#718078]"}`
            : `flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-start text-sm font-bold transition ${section === id ? "bg-[#eaf4ed] text-[#176744]" : "text-[#68766d] hover:bg-[#f4f7f4]"}`}
        >
          <Icon size={compact ? 19 : 18} />
          <span className={compact ? "max-w-full truncate" : ""}>{label}</span>
          {!compact && id === "kyc" && pendingDocuments.length > 0 && (
            <span className="ms-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800">{pendingDocuments.length}</span>
          )}
        </button>
      ))}
    </nav>
  );

  return (
    <main dir="rtl" lang="ar" className="min-h-screen bg-[#f6f8f6] pb-36 text-[#17231d] md:pb-0">
      <header className="sticky top-0 z-30 border-b border-[#e2e9e3] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[68px] max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8f4ec] text-xl font-extrabold text-[#17734e]">ا</span>
            <span><strong className="block text-sm text-[#145b3e]">مركز إدارة اكريلي</strong><span className="text-[9px] font-bold tracking-[0.18em] text-[#819086]">EKRRILI CONTROL CENTER</span></span>
          </Link>
          <div className="flex items-center gap-2">
            {data.demoMode && <span className="inline-flex shrink-0 rounded-full bg-amber-50 px-2 py-1.5 text-[9px] font-bold text-amber-800 sm:px-3 sm:text-[10px]"><span className="sm:hidden">تجريبي محلي</span><span className="hidden sm:inline">وضع تجريبي محلي — البيانات في هذا المتصفح فقط</span></span>}
            {!data.demoMode && <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-800 sm:inline-flex"><ShieldCheck size={14} /> جلسة مدير موثّقة</span>}
            <Link href="/" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[#e1e8e2] px-3 text-xs font-bold text-[#526159] hover:bg-[#f7faf7]"><LogOut size={15} /> <span className="hidden sm:inline">العودة إلى السوق</span></Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-6 px-4 py-5 sm:px-6 md:grid-cols-[238px_minmax(0,1fr)] md:gap-7 md:py-7">
        <aside className="hidden md:block">
          <div className="sticky top-[90px] rounded-2xl border border-[#e4eae5] bg-white p-3 shadow-[0_3px_14px_rgba(27,53,35,0.03)]">
            <p className="px-3 pb-3 pt-2 text-[10px] font-extrabold tracking-wide text-[#98a39b]">القائمة الرئيسية</p>
            {nav()}
            <div className="mt-5 border-t border-[#edf1ed] pt-4">
              <p className="px-3 text-[10px] leading-5 text-[#8a968e]">إدارة آمنة ومركزية للمستخدمين والإعلانات والطلبات.</p>
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-bold text-[#17734e]">مساحة المنصة</p>
              <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">{title}</h1>
              <p className="mt-1 text-xs text-[#7b887f]">إدارة ومتابعة جميع أنشطة اكريلي من مكان واحد.</p>
            </div>
            {(section === "listings" || section === "users") && (
              <label className="relative block w-full sm:max-w-xs">
                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#829087]" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={section === "users" ? "ابحث بالاسم أو الهاتف..." : "ابحث عن إعلان أو مالك..."} className="h-11 w-full rounded-xl border border-[#e0e7e1] bg-white pr-9 pl-3 text-sm outline-none focus:border-[#84b99a]" />
              </label>
            )}
          </div>

          {feedback.error && <p role="alert" className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">{feedback.error}</p>}
          {feedback.success && <p role="status" className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{feedback.success}</p>}

          {section === "overview" && (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard label="إجمالي المستخدمين" value={data.profiles.length} detail="حسابات مسجلة على المنصة" icon={UsersRound} tint="bg-[#edf5ef] text-[#176744]" />
                <StatCard label="الإعلانات النشطة" value={activeListings} detail="إعلانات مبوبة منشورة في السوق" icon={ClipboardList} tint="bg-sky-50 text-sky-700" />
                <StatCard label="توثيق الهوية المعلّق" value={pendingDocuments.length} detail="طلبات تنتظر مراجعة الإدارة" icon={FileCheck2} tint="bg-amber-50 text-amber-700" />
                <StatCard label="البلاغات المفتوحة" value={openDisputes} detail="بلاغات تنتظر مراجعة الإدارة" icon={AlertTriangle} tint="bg-violet-50 text-violet-700" />
              </div>
              <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                <section className="rounded-2xl border border-[#e4eae5] bg-white p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div><h2 className="font-extrabold">طلبات توثيق حديثة</h2><p className="mt-1 text-xs text-[#829087]">مراجعة وثائق الهوية المعلقة</p></div>
                    <button type="button" onClick={() => setSection("kyc")} className="text-xs font-bold text-[#176744]">عرض الكل</button>
                  </div>
                  {pendingDocuments.length ? <div className="divide-y divide-[#edf1ed]">
                    {pendingDocuments.slice(0, 4).map((document) => (
                      <button key={document.id} type="button" onClick={() => setSection("kyc")} className="flex w-full items-center justify-between gap-3 py-3 text-start hover:bg-[#fafcfa]">
                        <span><strong className="block text-sm">{document.fullName}</strong><small className="mt-1 block text-[11px] text-[#87938a]">{new Date(document.submittedAt).toLocaleDateString("ar-DZ")}</small></span>
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800">بانتظار المراجعة</span>
                      </button>
                    ))}
                  </div> : <EmptyState>لا توجد طلبات توثيق معلّقة.</EmptyState>}
                </section>
                <section className="rounded-2xl border border-[#e4eae5] bg-white p-5">
                  <h2 className="font-extrabold">حالة المنصة</h2>
                  <div className="mt-4 space-y-4">
                    <div className="flex items-center justify-between text-sm"><span className="text-[#728077]">الإعلانات المميزة</span><strong>{data.listings.filter(isListingFeatured).length}</strong></div>
                    <div className="h-px bg-[#edf1ed]" />
                    <div className="flex items-center justify-between text-sm"><span className="text-[#728077]">الحسابات الموقوفة</span><strong>{data.profiles.filter((profile) => profile.suspended).length}</strong></div>
                    <div className="h-px bg-[#edf1ed]" />
                    <div className="flex items-center justify-between text-sm"><span className="text-[#728077]">التصنيفات</span><strong>{data.categories.length}</strong></div>
                  </div>
                  <div className="mt-5 rounded-xl bg-[#f4f8f5] p-3 text-xs leading-6 text-[#617168]">يتم إخفاء المستندات الحساسة عن المستخدمين الآخرين، وتُعرض هنا بروابط خاصة قصيرة الصلاحية عند استخدام Supabase.</div>
                </section>
              </div>
            </div>
          )}

          {section === "kyc" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-[#e4eae5] bg-white px-4 py-3 text-sm">
                <span className="font-bold">قائمة طلبات توثيق الهوية</span><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-extrabold text-amber-800">{pendingDocuments.length} معلّق</span>
              </div>
              {pendingDocuments.length ? pendingDocuments.map((document) => (
                <article key={document.id} className="grid gap-4 rounded-2xl border border-[#e4eae5] bg-white p-4 shadow-[0_3px_14px_rgba(27,53,35,0.03)] lg:grid-cols-[minmax(240px,0.85fr)_minmax(280px,1.15fr)] lg:p-5">
                  <div>
                    {document.signedUrl ? document.signedUrl.toLowerCase().includes(".pdf")
                      ? <a href={document.signedUrl} target="_blank" rel="noreferrer" className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-2xl border border-[#e2e9e3] bg-[#f8faf8] p-4 text-sm font-bold text-[#176744]"><FileText size={36} />فتح وثيقة الهوية PDF</a>
                      : <a href={document.signedUrl} target="_blank" rel="noreferrer"><img src={document.signedUrl} alt={`وثيقة هوية ${document.fullName}`} className="max-h-64 w-full rounded-2xl border border-[#e2e9e3] object-contain" /></a>
                      : document.previewError
                        ? <p role="alert" className="flex min-h-48 items-center justify-center rounded-2xl border border-red-100 bg-red-50 p-5 text-center text-sm leading-6 text-red-800">تعذر إنشاء رابط آمن للوثيقة: {document.previewError}</p>
                        : data.demoMode
                          ? <DemoIdPreview />
                          : <p role="alert" className="flex min-h-48 items-center justify-center rounded-2xl border border-amber-100 bg-amber-50 p-5 text-center text-sm text-amber-800">لم يتم العثور على ملف الوثيقة في التخزين الخاص.</p>}
                    {data.demoMode && <p className="mt-2 text-center text-[10px] text-[#89958d]">معاينة بديلة توضيحية — لا توجد وثيقة حقيقية في الوضع المحلي</p>}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div><h2 className="text-lg font-extrabold">{document.fullName}</h2><p dir="ltr" className="mt-1 text-start text-sm text-[#728077]">{document.phone || "لا يوجد رقم هاتف"}</p></div>
                      <span className="rounded-full bg-amber-50 px-3 py-1.5 text-[10px] font-bold text-amber-800">طلب توثيق جديد</span>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-[#f7f9f7] p-3 text-xs">
                      <div><dt className="text-[#859188]">تاريخ التقديم</dt><dd className="mt-1 font-bold">{new Date(document.submittedAt).toLocaleDateString("ar-DZ")}</dd></div>
                      <div><dt className="text-[#859188]">رقم الحساب</dt><dd dir="ltr" className="mt-1 truncate text-start font-mono text-[10px]">{document.userId}</dd></div>
                    </dl>
                    {rejectingId === document.id && (
                      <div className="mt-4">
                        <label htmlFor={`reject-${document.id}`} className="mb-1.5 block text-xs font-bold">ملاحظة الرفض (مطلوبة)</label>
                        <textarea id={`reject-${document.id}`} value={rejectNote} onChange={(event) => setRejectNote(event.target.value)} rows={2} className="w-full rounded-xl border border-[#e0e7e1] p-3 text-sm outline-none focus:border-[#84b99a]" placeholder="اذكر سبب الرفض بوضوح" />
                      </div>
                    )}
                    <div className="mt-auto flex flex-wrap gap-2 pt-5">
                      <button disabled={busy === `${document.id}-approved`} onClick={() => void reviewDocument(document.id, "approved")} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#17734e] px-4 text-xs font-extrabold text-white hover:bg-[#10583b] disabled:opacity-50"><Check size={15} /> قبول وتوثيق الشارة</button>
                      {rejectingId === document.id
                        ? <button disabled={!rejectNote.trim() || busy === `${document.id}-rejected`} onClick={() => void reviewDocument(document.id, "rejected", rejectNote)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-red-200 px-4 text-xs font-bold text-red-700 disabled:opacity-40"><X size={15} /> تأكيد الرفض</button>
                        : <button onClick={() => { setRejectingId(document.id); setRejectNote(""); }} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-red-200 px-4 text-xs font-bold text-red-700"><Ban size={15} /> رفض الطلب</button>}
                    </div>
                  </div>
                </article>
              )) : <EmptyState>لا توجد طلبات توثيق معلّقة حالياً.</EmptyState>}
            </div>
          )}

          {section === "listings" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e4eae5] bg-white px-4 py-3">
                <p className="text-sm font-bold">جميع إعلانات السوق <span className="text-xs font-normal text-[#829087]">({visibleListings.length})</span></p>
                <select value={listingStatus} onChange={(event) => setListingStatus(event.target.value)} aria-label="تصفية حسب حالة الإعلان" className="h-9 rounded-lg border border-[#e0e7e1] bg-white px-3 text-xs">
                  <option value="all">كل الحالات</option><option value="active">نشط</option><option value="paused">متوقف</option><option value="rented">مؤجّر</option>
                </select>
              </div>
              {visibleListings.length ? <div className="overflow-hidden rounded-2xl border border-[#e4eae5] bg-white">
                <div className="hidden grid-cols-[minmax(220px,1.4fr)_minmax(130px,0.8fr)_110px_110px_minmax(230px,1.5fr)] gap-3 bg-[#f7f9f7] px-4 py-3 text-[10px] font-extrabold text-[#829087] lg:grid"><span>الإعلان</span><span>المالك</span><span>السعر / يوم</span><span>الحالة</span><span>الإجراءات</span></div>
                <div className="divide-y divide-[#edf1ed]">
                  {visibleListings.map((listing) => (
                    <article key={listing.id} className="grid gap-3 p-4 lg:grid-cols-[minmax(220px,1.4fr)_minmax(130px,0.8fr)_110px_110px_minmax(230px,1.5fr)] lg:items-center">
                      <div className="flex min-w-0 items-center gap-3">
                        {listing.image ? <img src={listing.image} alt="" className="h-12 w-14 shrink-0 rounded-lg bg-[#f1f5f2] object-cover" /> : <span className="flex h-12 w-14 shrink-0 items-center justify-center rounded-lg bg-[#f1f5f2] text-[#8b978f]"><ClipboardList size={20} /></span>}
                        <div className="min-w-0"><p className="truncate text-sm font-bold">{listing.title}</p><p className="mt-1 truncate text-[10px] text-[#87938a]">{listing.categoryName} {isListingFeatured(listing) && <span className="ms-1 text-amber-700">· مميز حتى {listing.featuredUntil ? new Date(listing.featuredUntil).toLocaleDateString("ar-DZ") : "—"}</span>}</p></div>
                      </div>
                      <p className="text-xs text-[#69776e] lg:truncate">{listing.ownerName}</p>
                      <p className="text-xs font-bold">{formatMoney(listing.price)}</p>
                      <span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-bold ${listing.status === "active" ? "bg-emerald-50 text-emerald-800" : listing.status === "paused" ? "bg-amber-50 text-amber-800" : "bg-sky-50 text-sky-800"}`}>{statusLabels[listing.status] ?? listing.status}</span>
                      <div className="flex flex-wrap gap-1.5">
                        <button disabled={busy.startsWith(`${listing.id}-`)} onClick={() => void changeListing(listing.id, isListingFeatured(listing) ? "unfeature" : "feature")} title={isListingFeatured(listing) ? "إلغاء التمييز" : "تمييز الإعلان"} className="flex h-9 items-center gap-1.5 rounded-lg border border-amber-200 px-2.5 text-[10px] font-bold text-amber-800 disabled:opacity-50"><Star size={14} />{isListingFeatured(listing) ? "إلغاء التمييز" : "تمييز"}</button>
                        {listing.status !== "rented" && <button disabled={busy.startsWith(`${listing.id}-`)} onClick={() => void changeListing(listing.id, listing.status === "active" ? "pause" : "activate")} className="flex h-9 items-center gap-1.5 rounded-lg border border-[#e0e7e1] px-2.5 text-[10px] font-bold text-[#526159] disabled:opacity-50">{listing.status === "active" ? <><Pause size={14} /> إيقاف</> : <><Play size={14} /> تفعيل</>}</button>}
                        <button disabled={busy.startsWith(`${listing.id}-`)} onClick={() => { if (window.confirm("هل تريد حذف هذا الإعلان نهائياً؟")) void changeListing(listing.id, "delete"); }} className="flex h-9 items-center gap-1.5 rounded-lg border border-red-100 px-2.5 text-[10px] font-bold text-red-700 disabled:opacity-50"><Trash2 size={14} />حذف</button>
                      </div>
                    </article>
                  ))}
                </div>
              </div> : <EmptyState>لا توجد إعلانات تطابق البحث أو الفلتر.</EmptyState>}
            </div>
          )}

          {section === "users" && (
            <div className="overflow-hidden rounded-2xl border border-[#e4eae5] bg-white">
              <div className="flex items-center justify-between border-b border-[#edf1ed] px-4 py-3"><p className="text-sm font-bold">حسابات المنصة</p><span className="text-xs text-[#829087]">{visibleProfiles.length} مستخدم</span></div>
              {visibleProfiles.length ? <div className="divide-y divide-[#edf1ed]">
                {visibleProfiles.map((profile) => (
                  <article key={profile.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#edf5ef] text-sm font-extrabold text-[#176744]">{profile.fullName.slice(0, 1) || <UserRound size={18} />}</span>
                      <div className="min-w-0"><p className="truncate text-sm font-extrabold">{profile.fullName || "عضو اكريلي"}</p><p className="mt-1 truncate text-xs text-[#829087]">{profile.email || profile.phone || "لا توجد بيانات اتصال"}{profile.wilaya && ` · ${profile.wilaya}`}</p><p dir="ltr" className="mt-1 truncate text-start font-mono text-[9px] text-[#9aa49d]">{profile.id}</p></div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${profile.role === "admin" ? "bg-violet-50 text-violet-800" : "bg-[#f2f5f2] text-[#66746b]"}`}>{profile.role === "admin" ? "مدير" : "مستخدم"}</span>
                      <button disabled={profile.role === "admin" || busy === `${profile.id}-verified`} onClick={() => void updateUserFlag(profile.id, "verified", !profile.verified)} className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[10px] font-bold disabled:opacity-50 ${profile.verified ? "border-emerald-100 text-emerald-800" : "border-[#e0e7e1] text-[#66746b]"}`}>{profile.verified ? <><BadgeCheck size={14} /> موثّق · إلغاء</> : <><ShieldCheck size={14} /> منح الشارة</>}</button>
                      <button disabled={profile.role === "admin" || busy === `${profile.id}-suspended`} onClick={() => void updateUserFlag(profile.id, "suspended", !profile.suspended)} className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 text-[10px] font-bold disabled:opacity-50 ${profile.suspended ? "border-amber-200 bg-amber-50 text-amber-800" : "border-red-100 text-red-700"}`}>{profile.suspended ? <><CheckCircle2 size={14} /> رفع الإيقاف</> : <><Ban size={14} /> إيقاف الحساب</>}</button>
                    </div>
                  </article>
                ))}
              </div> : <EmptyState>لا يوجد مستخدمون مطابقون للبحث.</EmptyState>}
            </div>
          )}

          {false && section === "rentals" && (
            <section className="overflow-hidden rounded-2xl border border-[#e4eae5] bg-white">
              <div className="flex items-center justify-between border-b border-[#edf1ed] px-4 py-3"><div><h2 className="text-sm font-bold">طلبات الكراء والعقود</h2><p className="mt-1 text-[10px] text-[#829087]">مراقبة المنصة وفتح العقد للطباعة وحل النزاعات</p></div><span className="text-xs text-[#829087]">{data.rentals.length} طلب</span></div>
              {data.rentals.length ? <div className="divide-y divide-[#edf1ed]">
                {data.rentals.map((rental) => (
                  <article key={rental.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold">{rental.listingTitle}</p>
                      <p className="mt-1 text-xs text-[#6e7b72]">المالك: {rental.ownerName} · المستأجر: {rental.renterName}</p>
                      <p className="mt-1 text-[10px] text-[#87938a]">{rental.startDate} — {rental.endDate} · {formatMoney(rental.totalPrice)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-full bg-[#f2f5f2] px-2.5 py-1 text-[10px] font-bold">{statusLabels[rental.status] ?? rental.status}</span>
                      <Link href={data.demoMode ? "/agreement-demo" : `/admin/contracts/${rental.id}`} target={data.demoMode ? "_blank" : undefined} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#17734e] px-3 text-[10px] font-bold text-white hover:bg-[#10583b]"><FileText size={14} />{data.demoMode ? "معاينة عقد" : "فتح وطباعة العقد"}</Link>
                    </div>
                  </article>
                ))}
              </div> : <EmptyState>لا توجد طلبات كراء على المنصة.</EmptyState>}
            </section>
          )}

          {section === "promotions" && (
            <section className="overflow-hidden rounded-2xl border border-[#e4eae5] bg-white">
              <div className="flex items-center justify-between border-b border-[#edf1ed] px-4 py-3">
                <div><h2 className="text-sm font-bold">إيصالات ترقية الإعلانات</h2><p className="mt-1 text-[10px] text-[#829087]">راجع إيصالات BaridiMob وCCP قبل تفعيل الشارة المميزة.</p></div>
                <span className="text-xs text-[#829087]">{data.promotions.filter((item) => item.status === "pending").length} قيد المراجعة</span>
              </div>
              {data.promotions.filter((item) => item.status === "pending").length ? (
                <div className="divide-y divide-[#edf1ed]">
                  {data.promotions.filter((item) => item.status === "pending").map((promotion) => (
                    <article key={promotion.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold">{promotion.listingTitle}</p>
                        <p className="mt-1 text-xs text-[#728077]">{promotion.ownerName} · {new Date(promotion.submittedAt).toLocaleDateString("ar-DZ")}</p>
                        <dl className="mt-3 grid gap-x-5 gap-y-2 rounded-xl bg-[#f7f9f7] p-3 text-[11px] sm:grid-cols-2">
                          <div><dt className="text-[#829087]">الباقة</dt><dd className="mt-0.5 font-bold">{(data.paymentSettings.promotion_plans.find((plan) => plan.id === promotion.planId)?.name ?? promotion.planId) || "—"} · {promotion.durationDays} يوماً</dd></div>
                          <div><dt className="text-[#829087]">المبلغ</dt><dd className="mt-0.5 font-bold">{promotion.currency === "USD" ? `$${promotion.amountUsd} USD / USDT` : formatMoney(promotion.amountDzd)}</dd></div>
                          <div><dt className="text-[#829087]">طريقة الدفع</dt><dd className="mt-0.5 font-bold">{promotion.paymentMethod === "baridimob" ? "BaridiMob" : promotion.paymentMethod === "bybit" ? "Bybit" : "CCP"}</dd></div>
                          <div><dt className="text-[#829087]">رقم العملية</dt><dd dir="ltr" className="mt-0.5 break-all text-start font-mono font-bold">{promotion.paymentReference || "—"}</dd></div>
                          <div className="sm:col-span-2"><dt className="text-[#829087]">اسم المرسل / آخر أرقام RIP</dt><dd className="mt-0.5 font-bold">{promotion.senderInfo || "—"}</dd></div>
                        </dl>
                        {promotion.receiptUrl ? <div className="mt-3 flex flex-wrap items-center gap-3">
                          <button type="button" onClick={() => setReceiptPreview(promotion.receiptUrl)} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#e0e7e1] px-3 text-xs font-bold text-[#176744]"><FileText size={15} /> تكبير معاينة الإيصال</button>
                          <a href={promotion.receiptUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-[#176744] underline">فتح الصورة في نافذة جديدة</a>
                          <button type="button" onClick={() => void copyPaymentReference(promotion.paymentReference)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#e0e7e1] px-3 text-xs font-bold text-[#526159]"><Copy size={14} /> نسخ رقم العملية</button>
                        </div> : <p className="mt-2 text-xs text-[#728077]">{promotion.paymentMethod === "bybit" ? "لم يرفق المستخدم لقطة تحويل؛ راجع Bybit Transaction ID." : "تعذرت معاينة الإيصال."}</p>}
                      </div>
                      {promotionRejectId === promotion.id ? (
                        <form onSubmit={(event) => { event.preventDefault(); void reviewPromotion(promotion.id, "rejected", promotionRejectNote); }} className="flex min-w-0 flex-col gap-2 sm:w-72">
                          <textarea required minLength={3} maxLength={1000} value={promotionRejectNote} onChange={(event) => setPromotionRejectNote(event.target.value)} rows={2} placeholder="سبب رفض الإيصال" className="rounded-lg border border-[#e0e7e1] p-2 text-xs" />
                          <div className="flex gap-2"><button disabled={busy === `promotion-${promotion.id}`} className="min-h-9 rounded-lg bg-red-700 px-3 text-xs font-bold text-white">تأكيد الرفض</button><button type="button" onClick={() => setPromotionRejectId("")} className="min-h-9 rounded-lg border px-3 text-xs">إلغاء</button></div>
                        </form>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          <button disabled={busy === `promotion-${promotion.id}` || (promotion.paymentMethod !== "bybit" && !promotion.receiptUrl) || !promotion.paymentReference || !promotion.durationDays} onClick={() => void reviewPromotion(promotion.id, "approved")} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-[#17734e] px-3 text-xs font-bold text-white disabled:opacity-50"><Check size={15} /> تأكيد الدفع وتفعيل التمييز</button>
                          <button disabled={busy === `promotion-${promotion.id}`} onClick={() => { setPromotionRejectId(promotion.id); setPromotionRejectNote(""); }} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-xs font-bold text-red-700 disabled:opacity-50"><Ban size={15} /> رفض</button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              ) : <EmptyState>لا توجد طلبات ترقية قيد المراجعة.</EmptyState>}
            </section>
          )}

          {section === "payment-settings" && (
            <section className="rounded-2xl border border-[#e4eae5] bg-white p-4 sm:p-6">
              <div className="mb-5"><h2 className="text-base font-extrabold">إعدادات الدفع والباقات (Bybit &amp; BaridiMob)</h2><p className="mt-1 text-xs leading-5 text-[#829087]">تظهر بيانات التحويل الرسمية في checkout. لا تضع كلمات مرور أو رموز دخول شخصية هنا.</p></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-bold">رقم حساب CCP<input inputMode="numeric" value={data.paymentSettings.ccp_account_number} onChange={(event) => updatePaymentSetting("ccp_account_number", event.target.value)} maxLength={30} className="mt-1.5 h-11 w-full rounded-xl border border-[#e0e7e1] px-3 font-normal" /></label>
                <label className="text-xs font-bold">مفتاح CCP<input inputMode="numeric" value={data.paymentSettings.ccp_key} onChange={(event) => updatePaymentSetting("ccp_key", event.target.value)} maxLength={40} className="mt-1.5 h-11 w-full rounded-xl border border-[#e0e7e1] px-3 font-normal" /></label>
                <label className="text-xs font-bold">BaridiMob RIP<input inputMode="numeric" value={data.paymentSettings.baridimob_rip} onChange={(event) => updatePaymentSetting("baridimob_rip", event.target.value)} maxLength={40} placeholder="00799999..." className="mt-1.5 h-11 w-full rounded-xl border border-[#e0e7e1] px-3 font-normal" /></label>
                <label className="text-xs font-bold">اسم صاحب الحساب<input value={data.paymentSettings.account_holder_name} onChange={(event) => updatePaymentSetting("account_holder_name", event.target.value)} maxLength={120} className="mt-1.5 h-11 w-full rounded-xl border border-[#e0e7e1] px-3 font-normal" /></label>
                <label className="text-xs font-bold">Bybit UID<input dir="ltr" value={data.paymentSettings.bybit_uid} onChange={(event) => updatePaymentSetting("bybit_uid", event.target.value)} maxLength={80} className="mt-1.5 h-11 w-full rounded-xl border border-[#e0e7e1] px-3 text-start font-normal" /></label>
                <label className="text-xs font-bold">USDT Wallet Address<input dir="ltr" value={data.paymentSettings.usdt_wallet_address} onChange={(event) => updatePaymentSetting("usdt_wallet_address", event.target.value)} maxLength={120} className="mt-1.5 h-11 w-full rounded-xl border border-[#e0e7e1] px-3 text-start font-normal" /></label>
                <label className="text-xs font-bold sm:col-span-2">رابط صورة Bybit Pay QR (HTTPS)<input type="url" dir="ltr" value={data.paymentSettings.bybit_pay_qr_url} onChange={(event) => updatePaymentSetting("bybit_pay_qr_url", event.target.value)} maxLength={2048} className="mt-1.5 h-11 w-full rounded-xl border border-[#e0e7e1] px-3 text-start font-normal" /></label>
                <label className="text-xs font-bold sm:col-span-2">هاتف الدعم / WhatsApp<input type="tel" dir="ltr" value={data.paymentSettings.support_phone} onChange={(event) => updatePaymentSetting("support_phone", event.target.value)} maxLength={40} className="mt-1.5 h-11 w-full rounded-xl border border-[#e0e7e1] px-3 text-start font-normal" /></label>
              </div>
              <div className="mt-7 flex items-end justify-between gap-3">
                <div><h3 className="text-sm font-extrabold">باقات التمييز واشتراك المتجر</h3><p className="mt-1 text-[10px] text-[#829087]">تسري المدة من وقت اعتماد التحويل من الإدارة.</p></div>
                <span className="text-[10px] text-[#829087]">{data.paymentSettings.promotion_plans.length} باقات</span>
              </div>
              <div className="mt-3 grid gap-3 xl:grid-cols-3">
                {data.paymentSettings.promotion_plans.map((plan) => (
                  <article key={plan.id} className="rounded-xl border border-[#e4eae5] p-4">
                    <div className="mb-3 flex items-center justify-between gap-2"><span dir="ltr" className="font-mono text-[10px] text-[#87938a]">{plan.id}</span><label className="flex items-center gap-2 text-[10px] font-bold"><input type="checkbox" checked={plan.enabled} onChange={(event) => updatePromotionPlan(plan.id, "enabled", event.target.checked)} /> متاحة</label></div>
                    <label className="block text-[10px] font-bold">اسم الباقة<input value={plan.name} readOnly className="mt-1 h-10 w-full rounded-lg border border-[#e0e7e1] bg-[#f7f9f7] px-2 text-xs font-normal" /></label>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className="text-[10px] font-bold">المدة الثابتة / يوم<input type="number" value={plan.duration_days} readOnly className="mt-1 h-10 w-full rounded-lg border border-[#e0e7e1] bg-[#f7f9f7] px-2 text-xs font-normal" /></label>
                      <label className="text-[10px] font-bold">السعر / د.ج<input type="number" min={1} max={100000000} value={plan.amount_dzd} onChange={(event) => updatePromotionPlan(plan.id, "amount_dzd", Number(event.target.value))} required className="mt-1 h-10 w-full rounded-lg border border-[#e0e7e1] px-2 text-xs font-normal" /></label>
                      <label className="text-[10px] font-bold sm:col-span-2">السعر / USD (USDT)<input type="number" min={0.01} step="0.01" max={100000} value={plan.amount_usd} onChange={(event) => updatePromotionPlan(plan.id, "amount_usd", Number(event.target.value))} required className="mt-1 h-10 w-full rounded-lg border border-[#e0e7e1] px-2 text-xs font-normal" /></label>
                    </div>
                  </article>
                ))}
              </div>
              <div className="mt-8 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
                <div>
                  <h3 className="text-sm font-extrabold">أكواد التجربة المجانية</h3>
                  <p className="mt-1 text-[10px] leading-5 text-[#718078]">كل حساب يستطيع استخدام الرمز مرة واحدة؛ يمكن تحديد حد إجمالي للاستخدامات.</p>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_140px_140px_auto]">
                  <input aria-label="الرمز الترويجي الجديد" value={promoCodeDraft} onChange={(event) => setPromoCodeDraft(event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))} maxLength={32} placeholder="LAUNCH2026" className="h-10 min-w-0 rounded-lg border border-[#dce5dd] bg-white px-3 text-xs font-mono" />
                  <select aria-label="مدة الرمز الترويجي" value={promoDaysDraft} onChange={(event) => setPromoDaysDraft(Number(event.target.value) as 7 | 14)} className="h-10 rounded-lg border border-[#dce5dd] bg-white px-2 text-xs"><option value={7}>7 أيام مجانية</option><option value={14}>14 يوماً مجاناً</option></select>
                  <input aria-label="الحد الإجمالي للاستخدامات" type="number" min={1} value={promoLimitDraft} onChange={(event) => setPromoLimitDraft(event.target.value)} placeholder="بدون حد" className="h-10 rounded-lg border border-[#dce5dd] bg-white px-3 text-xs" />
                  <button type="button" onClick={addPromoCode} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-emerald-800 px-3 text-xs font-bold text-white"><Check size={14} /> إضافة الرمز</button>
                </div>
                {data.paymentSettings.promo_codes.length > 0 && (
                  <ul className="mt-3 divide-y divide-emerald-100 rounded-xl border border-emerald-100 bg-white">
                    {data.paymentSettings.promo_codes.map((promo) => (
                      <li key={promo.code} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs">
                        <span dir="ltr" className="font-mono font-bold">{promo.code}</span>
                        <span>{promo.duration_days} يوماً مجاناً · {promo.redeemed_count}{promo.max_uses === null ? "" : ` / ${promo.max_uses}`} استخدام</span>
                        <button type="button" aria-label={`حذف الرمز ${promo.code}`} onClick={() => setData((current) => ({ ...current, paymentSettings: { ...current.paymentSettings, promo_codes: current.paymentSettings.promo_codes.filter((item) => item.code !== promo.code) } }))} className="rounded-md p-1 text-red-700 hover:bg-red-50"><Trash2 size={15} /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="mt-5 flex justify-end"><button type="button" disabled={busy === "payment-settings"} onClick={() => void savePaymentSettings()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#17734e] px-5 text-xs font-bold text-white disabled:opacity-50"><Check size={15} /> حفظ إعدادات الدفع والباقات</button></div>
            </section>
          )}

          {section === "disputes" && (
            <section className="rounded-2xl border border-[#e4eae5] bg-white">
              <div className="border-b border-[#edf1ed] px-4 py-3"><h2 className="font-bold">البلاغات المتعلقة بالإعلانات</h2><p className="mt-1 text-[10px] text-[#829087]">راجع وصف البلاغ والإعلان والحسابات، واتخذ إجراءً بشأن محتوى المنصة عند الحاجة.</p></div>
              {data.disputes.length ? <div className="divide-y divide-[#edf1ed]">{data.disputes.map((report) => (
                <article key={report.id} className="space-y-3 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2"><div><strong className="text-sm">{report.listingTitle}</strong><p className="mt-1 text-xs text-[#758179]">المبلّغ: {report.reporterName} · {new Date(report.createdAt).toLocaleDateString("ar-DZ")}</p></div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-800">{statusLabels[report.status] ?? report.status}</span></div>
                  <p className="text-xs font-bold text-red-700">{({ damage: "إتلاف الغرض", late_return: "تأخير الإرجاع", no_show: "عدم الحضور", fraud: "احتيال", other: "أخرى" } as Record<string, string>)[report.reason] ?? report.reason}</p>
                  <p className="whitespace-pre-wrap rounded-xl bg-[#f7f9f7] p-3 text-sm leading-6">{report.details}</p>
                  <div className="flex flex-wrap gap-2">
                    {report.targetUserId && <button type="button" onClick={() => void updateUserFlag(report.targetUserId!, "suspended", true)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700">إيقاف الحساب المبلّغ عنه</button>}
                    {(["reviewing", "resolved", "dismissed"] as const).map((decision) => <button key={decision} type="button" disabled={busy === `dispute-${report.id}`} onClick={() => void resolveDispute(report.id, decision)} className="rounded-lg bg-[#edf5ef] px-3 py-2 text-xs font-bold text-[#176744]">{decision === "reviewing" ? "قيد المراجعة" : decision === "resolved" ? "تم الحل" : "إغلاق البلاغ"}</button>)}
                  </div>
                </article>
              ))}</div> : <EmptyState>لا توجد بلاغات مسجلة.</EmptyState>}
            </section>
          )}

          {section === "pro-stores" && (
            <section className="rounded-2xl border border-[#e4eae5] bg-white">
              <div className="border-b border-[#edf1ed] px-4 py-3"><h2 className="font-bold">طلبات متاجر المحترفين</h2><p className="mt-1 text-[10px] text-[#829087]">راجع إيصال الاشتراك وبيانات النشاط قبل الاعتماد.</p></div>
              {data.proStoreApplications.filter((item) => item.status === "pending").length ? <div className="divide-y divide-[#edf1ed]">{data.proStoreApplications.filter((item) => item.status === "pending").map((application) => (
                <article key={application.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0"><h3 className="font-extrabold">{application.storeName}</h3><p className="mt-1 text-xs text-[#748078]">{application.ownerName} · {application.wilaya} · {application.proDays} يوماً · {application.currency === "USD" ? `$${application.amountUsd} USD / USDT` : `${formatMoney(application.amountDzd)} DZD`}</p><p dir="ltr" className="mt-1 text-start font-mono text-xs">{application.slug}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{application.bio || "لا توجد نبذة."}</p>
                    {Object.keys(application.businessHours).length > 0 && <p className="mt-2 text-xs text-[#68766d]">ساعات العمل: {Object.entries(application.businessHours).map(([day, hours]) => `${day}: ${hours}`).join(" · ")}</p>}
                    <p className="mt-2 text-xs">طريقة الدفع: {application.paymentMethod === "bybit" ? "Bybit" : application.paymentMethod === "baridimob" ? "BaridiMob" : "CCP"}</p><p dir="ltr" className="mt-1 text-start text-xs">رقم العملية: {application.paymentReference} · {application.senderInfo}</p>
                    {application.receiptUrl && <button type="button" onClick={() => setReceiptPreview(application.receiptUrl)} className="mt-2 rounded-lg border px-3 py-2 text-xs font-bold text-[#176744]">تكبير إيصال الدفع</button>}
                  </div>
                  <div className="flex shrink-0 gap-2"><button type="button" disabled={busy === `pro-store-${application.id}`} onClick={() => void decideProStore(application.id, "approved")} className="rounded-lg bg-[#17734e] px-3 py-2 text-xs font-bold text-white">اعتماد المتجر</button><button type="button" disabled={busy === `pro-store-${application.id}`} onClick={() => void decideProStore(application.id, "rejected")} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700">رفض الطلب</button></div>
                </article>
              ))}</div> : <EmptyState>لا توجد طلبات متاجر محترفين قيد المراجعة.</EmptyState>}
              {data.proStores.length > 0 && <div className="border-t border-[#edf1ed] p-4">
                <h3 className="font-bold">المتاجر المعتمدة وإدارة الانتهاء</h3>
                <div className="mt-3 space-y-2">{data.proStores.map((store) => (
                  <div key={store.ownerId} className="flex flex-col gap-2 rounded-xl bg-[#f7f9f7] p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div><strong className="text-sm">{store.storeName}</strong><p className="mt-1 text-[10px] text-[#758179]">{store.ownerName} · <Link href={`/stores/${store.slug}`} className="text-[#176744]">/{store.slug}</Link> · {Date.parse(store.proUntil) > currentTime ? `متبقي ${Math.ceil((Date.parse(store.proUntil) - currentTime) / 86_400_000)} يوم` : "انتهى الاشتراك"} · ينتهي {new Date(store.proUntil).toLocaleDateString("ar-DZ")}</p></div>
                    <div className="flex gap-2"><input type="date" aria-label={`تاريخ انتهاء ${store.storeName}`} min={new Date().toISOString().slice(0, 10)} value={storeExpiryDrafts[store.ownerId] ?? store.proUntil.slice(0, 10)} onChange={(event) => setStoreExpiryDrafts((current) => ({ ...current, [store.ownerId]: event.target.value }))} className="h-9 rounded-lg border px-2 text-xs" /><button type="button" disabled={busy === `store-expiry-${store.ownerId}`} onClick={() => void updateStoreExpiry(store.ownerId)} className="rounded-lg bg-[#17734e] px-3 text-xs font-bold text-white">حفظ الانتهاء</button></div>
                  </div>
                ))}</div>
              </div>}
            </section>
          )}

          {section === "categories" && (
            <div className="grid gap-4 xl:grid-cols-2">
              {data.categories.map((category) => (
                <article key={category.id} className="rounded-2xl border border-[#e4eae5] bg-white p-4 sm:p-5">
                  {editingCategory === category.id ? (
                    <form onSubmit={(event) => saveCategory(event, category.id)} className="space-y-3">
                      <div className="flex items-center justify-between"><h2 className="font-extrabold">تعديل التصنيف</h2><button type="button" onClick={() => setEditingCategory(null)} aria-label="إلغاء التعديل"><X size={18} /></button></div>
                      <label className="block text-xs font-bold">الاسم بالعربية<input name="nameAr" required defaultValue={category.nameAr} className="mt-1.5 h-10 w-full rounded-lg border border-[#e0e7e1] px-3 text-sm" /></label>
                      <label className="block text-xs font-bold">الاسم بالفرنسية<input name="nameFr" required defaultValue={category.nameFr} className="mt-1.5 h-10 w-full rounded-lg border border-[#e0e7e1] px-3 text-sm" /></label>
                      <label className="block text-xs font-bold">الحقول الديناميكية (JSON)<textarea value={categoryJson} onChange={(event) => setCategoryJson(event.target.value)} rows={8} dir="ltr" className="mt-1.5 w-full rounded-lg border border-[#e0e7e1] p-3 text-left font-mono text-xs" /></label>
                      <button disabled={busy === `category-${category.id}`} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#17734e] px-4 text-xs font-bold text-white disabled:opacity-50"><Check size={15} /> حفظ التغييرات</button>
                    </form>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="text-[10px] font-bold text-[#8a968e]">{category.slug}</p><h2 className="mt-1 font-extrabold">{category.nameAr}</h2><p className="mt-1 text-xs text-[#728077]" dir="ltr">{category.nameFr}</p></div>
                        <button type="button" onClick={() => { setEditingCategory(category.id); setCategoryJson(JSON.stringify(category.dynamicSchema ?? {}, null, 2)); }} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#e0e7e1] px-3 text-[10px] font-bold text-[#526159]"><Pencil size={14} /> تعديل</button>
                      </div>
                      <pre dir="ltr" className="mt-4 max-h-44 overflow-auto rounded-xl bg-[#f7f9f7] p-3 text-left text-[10px] leading-5 text-[#637168]">{JSON.stringify(category.dynamicSchema ?? {}, null, 2)}</pre>
                    </>
                  )}
                </article>
              ))}
              {!data.categories.length && <div className="xl:col-span-2"><EmptyState>لا توجد تصنيفات لإدارتها.</EmptyState></div>}
            </div>
          )}
        </section>
      </div>

      {receiptPreview && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-3 sm:p-8" onClick={() => setReceiptPreview(null)}>
          <section role="dialog" aria-modal="true" aria-label="معاينة إيصال الدفع" className="relative flex max-h-full max-w-full flex-col items-center gap-3" onClick={(event) => event.stopPropagation()}>
            <button type="button" autoFocus onClick={() => setReceiptPreview(null)} aria-label="إغلاق معاينة الإيصال" className="ms-auto flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#17231d]"><X size={20} /></button>
            <img src={receiptPreview} alt="إيصال الدفع كامل الحجم" className="max-h-[82dvh] max-w-[min(92vw,1100px)] cursor-zoom-out rounded-lg bg-white object-contain" onClick={() => setReceiptPreview(null)} />
            <a href={receiptPreview} target="_blank" rel="noreferrer" className="rounded-lg bg-white px-4 py-2 text-xs font-bold text-[#176744]">فتح الأصل في نافذة جديدة</a>
          </section>
        </div>
      )}

      <nav aria-label="التنقل في لوحة الإدارة" className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e2e9e3] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {nav(true)}
      </nav>
    </main>
  );
}
