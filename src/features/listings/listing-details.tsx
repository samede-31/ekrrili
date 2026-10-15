"use client";

import {
  BadgeCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  FileText,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Phone,
  ShieldCheck,
  Star,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { categories, locations, type CategoryId } from "@/features/listings/listing-options";
import {
  getListingOwnerContact,
} from "@/features/listings/booking-actions";
import { getLocalMarketplace } from "@/features/listings/local-marketplace";
import { cn } from "@/lib/utils";
import { ListingSocialActions } from "@/features/listings/listing-social-actions";
import { ReportDisputeModal } from "@/features/disputes/report-dispute-modal";
import { useSiteLanguage, type SiteLanguage } from "@/components/site-preferences";

type ListingDetailsData = {
  id: string;
  title: string;
  description: string;
  categoryId: CategoryId;
  categoryName: string;
  pricePerDay: number;
  pricePerWeek?: number | null;
  pricePerMonth?: number | null;
  deliveryAvailable?: boolean;
  deliveryFeeDzd?: number;
  addons?: Array<{ name: string; price_per_day_dzd: number }>;
  cautionAmount: number;
  cautionType: "cash" | "cheque" | null;
  wilayaCode: string | null;
  wilayaName: string;
  commune: string;
  images: string[];
  metadata: Record<string, unknown>;
  condition: string;
  status: "active" | "paused" | "rented";
  featured?: boolean;
  owner: {
    id: string;
    fullName: string;
    identityVerified: boolean;
    rating: number;
    avatarUrl: string | null;
    responseRate: number | null;
  };
};

type DynamicSchemaField = {
  name?: unknown;
  label?: unknown;
  type?: unknown;
  options?: unknown;
};

const money = new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 0 });

const detailCopy = {
  ar: {
    back: "العودة إلى السوق",
    demo: "إعلان توضيحي · بيانات تجريبية محفوظة محلياً فقط.",
    active: "إعلان نشط — تحقق من الإتاحة مباشرة مع المالك",
    paused: "متوقف مؤقتاً",
    unavailable: "غير متاح حالياً",
    condition: "الحالة عند التسليم",
    handover: "بروتوكول فحص الاستلام والإرجاع بالصور",
    handoverDescription: "لحماية الطرفين، اتفقا مباشرة على فحص الغرض وملحقاته قبل التسليم وبعد الإرجاع، والتقطا صوراً مؤرخة للحالة وسجّلا أي ملاحظات أو أرقام تسلسلية. احتفظا بنسخة من السجل خارج المنصة؛ اكريلي لا تتحقق من التسليم أو حالة الأغراض.",
    listingInfo: "معلومات الإعلان",
    specifications: "المواصفات",
    noSpecs: "لم تُسجّل مواصفات إضافية لهذا الإعلان.",
    owner: "صاحب الإعلان",
    rating: "التقييم",
    verified: "هوية موثّقة",
    responseRate: "معدل الرد",
    location: "الموقع",
    contract: "نموذج عقد اختياري للطباعة والتوقيع",
    contractDisclaimer: "هذا العقد نموذج استرشادي اختياري ولا تتحمل منصة اكريلي أي مسؤولية قانونية عنه.",
    platformDisclaimer: "اكريلي منصة إعلانات مبوبة فقط؛ التواصل والدفع والتسليم يتم مباشرة بين المستخدمين خارج المنصة.",
  priceDay: "دج / يوم",
  announcedPrice: "السعر المعلن",
  weeklyPrice: "السعر الأسبوعي",
  monthlyPrice: "السعر الشهري",
  caution: "الضمان (Caution)",
  noCaution: "بدون ضمان",
  cautionNote: "يناقش الطرفان مبلغ الضمان وطريقة دفعه واسترداده مباشرة. اكريلي لا تستلم أي مبالغ ولا تحتفظ بها.",
  yourListing: "هذا إعلانك.",
  whatsapp: "مراسلة عبر واتساب",
  phone: "اتصال هاتفي",
  contact: "عرض وسائل التواصل مع المالك",
  notAvailable: "الإعلان غير متاح حالياً",
  },
  en: {
    back: "Back to marketplace",
    demo: "Demo listing · sample data is saved only in this browser.",
    active: "Active listing — confirm availability directly with the owner",
    paused: "Temporarily paused",
    unavailable: "Currently unavailable",
    condition: "Condition at handover",
    handover: "Photo-based handover inspection protocol",
    handoverDescription: "For both parties' protection, inspect the item and accessories together before handover and after return. Take dated photos, note any condition issues and serial numbers, and keep the record outside Ekrrili. The platform does not verify handovers or item condition.",
    listingInfo: "Listing information",
    specifications: "Specifications",
    noSpecs: "No additional specifications were provided.",
    owner: "Listing owner",
    rating: "rating",
    verified: "Identity verified",
    responseRate: "Response rate",
    location: "Location",
    contract: "Optional agreement template to print and sign",
    contractDisclaimer: "This is an optional reference template; Ekrrili assumes no legal responsibility for it.",
    platformDisclaimer: "Ekrrili is a classifieds platform only. Contact, payment, and handover take place directly between users off-platform.",
  priceDay: "DZD / day",
  announcedPrice: "Listed price",
  weeklyPrice: "Weekly price",
  monthlyPrice: "Monthly price",
  caution: "Security deposit",
  noCaution: "No deposit",
  cautionNote: "Discuss the deposit amount, payment, and return directly. Ekrrili does not receive or hold any funds.",
  yourListing: "This is your listing.",
  whatsapp: "Message on WhatsApp",
  phone: "Call",
  contact: "Show owner's contact details",
  notAvailable: "This listing is unavailable",
  },
  fr: {
    back: "Retour au marché",
    demo: "Annonce de démonstration · données conservées dans ce navigateur uniquement.",
    active: "Annonce active — confirmez la disponibilité directement avec le propriétaire",
    paused: "Temporairement suspendue",
    unavailable: "Actuellement indisponible",
    condition: "État lors de la remise",
    handover: "Protocole d'inspection avec photos",
    handoverDescription: "Pour protéger les deux parties, inspectez ensemble l'objet et ses accessoires avant la remise et après le retour. Prenez des photos datées, notez l'état et les numéros de série, puis conservez ce dossier hors d'Ekrrili. La plateforme ne vérifie ni les remises ni l'état des objets.",
    listingInfo: "Informations sur l'annonce",
    specifications: "Caractéristiques",
    noSpecs: "Aucune caractéristique supplémentaire n'a été fournie.",
    owner: "Propriétaire de l'annonce",
    rating: "avis",
    verified: "Identité vérifiée",
    responseRate: "Taux de réponse",
    location: "Emplacement",
    contract: "Modèle d'accord facultatif à imprimer et signer",
    contractDisclaimer: "Ce modèle est facultatif; Ekrrili décline toute responsabilité juridique à son égard.",
    platformDisclaimer: "Ekrrili est une plateforme de petites annonces. Contact, paiement et remise se font directement entre utilisateurs, hors plateforme.",
  priceDay: "DA / jour",
  announcedPrice: "Prix affiché",
  weeklyPrice: "Prix hebdomadaire",
  monthlyPrice: "Prix mensuel",
  caution: "Dépôt de garantie",
  noCaution: "Sans dépôt",
  cautionNote: "Les parties discutent directement du montant, du paiement et du remboursement du dépôt. Ekrrili ne reçoit ni ne conserve de fonds.",
  yourListing: "C'est votre annonce.",
  whatsapp: "Écrire sur WhatsApp",
  phone: "Appeler",
  contact: "Afficher les coordonnées du propriétaire",
  notAvailable: "Cette annonce est indisponible",
  },
} satisfies Record<SiteLanguage, Record<string, string>>;

function keyLabel(key: string) {
  const labels: Record<string, string> = {
    model: "الطراز",
    serialNumber: "الرقم التسلسلي",
    accessories: "الملحقات",
    transmission: "ناقل الحركة",
    fuelType: "نوع الوقود",
    mileage: "المسافة المقطوعة",
    machineType: "نوع الآلة",
    operatingHours: "ساعات التشغيل",
    powerSource: "مصدر الطاقة",
    itemType: "نوع الغرض",
    quantity: "الكمية",
    capacity: "السعة",
    propertyType: "نوع العقار",
    bedrooms: "عدد الغرف",
    area: "المساحة",
    voltage: "الجهد الكهربائي",
  };
  return labels[key] ?? key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (letter) => letter.toUpperCase());
}

function categoryValueLabel(categoryId: CategoryId, fieldName: string, value: string) {
  const field = categories.find((category) => category.id === categoryId)?.fields.find((candidate) => candidate.name === fieldName);
  const option = field?.options?.find((candidate) => candidate.value === value);
  return option?.label.ar ?? value;
}

function displayMetadata(
  categoryId: CategoryId,
  metadata: Record<string, unknown>,
  dynamicFields: DynamicSchemaField[],
) {
  const knownFields = categories.find((category) => category.id === categoryId)?.fields ?? [];
  const schemaLabels = new Map(
    dynamicFields.flatMap((field) =>
      typeof field.name !== "string"
        ? []
        : typeof field.label === "string"
          ? [[field.name, field.label] as const]
          : typeof field.label === "object" && field.label !== null && "ar" in field.label && typeof field.label.ar === "string"
            ? [[field.name, field.label.ar] as const]
            : [],
    ),
  );
  const keys = [...new Set([...knownFields.map((field) => field.name), ...Object.keys(metadata)])];
  return keys.flatMap((key) => {
    const value = metadata[key];
    if (value === null || value === undefined || value === "") return [];
    const known = knownFields.find((field) => field.name === key);
    const label = schemaLabels.get(key) ?? known?.label.ar ?? keyLabel(key);
    let values: string[];
    if (Array.isArray(value)) {
      values = value.map((item) => categoryValueLabel(categoryId, key, String(item)));
    } else if (typeof value === "boolean") {
      values = [value ? "نعم" : "لا"];
    } else {
      values = [categoryValueLabel(categoryId, key, String(value))];
    }
    return [{ key, label, value: values.join("، ") }];
  });
}

export function ListingDetails({
  listing,
  dynamicFields = [],
  demo,
  ownerIsViewer,
  isAuthenticated,
}: {
  listing: ListingDetailsData;
  dynamicFields?: DynamicSchemaField[];
  demo: boolean;
  ownerIsViewer: boolean;
  isAuthenticated: boolean;
}) {
  const [imageIndex, setImageIndex] = useState(0);
  const [contactBusy, setContactBusy] = useState(false);
  const [ownerPhone, setOwnerPhone] = useState(demo ? demoPhone(listing.id) : "");
  const [feedback, setFeedback] = useState<{ success?: string; error?: string }>({});
  const language = useSiteLanguage();
  const text = detailCopy[language];
  const direction = language === "ar" ? "rtl" : "ltr";
  const router = useRouter();
  const category = categories.find((item) => item.id === listing.categoryId);
  const metadata = useMemo(
    () => displayMetadata(listing.categoryId, listing.metadata, dynamicFields),
    [dynamicFields, listing.categoryId, listing.metadata],
  );
  const images = listing.images.length ? listing.images : ["/images/listing-placeholder.svg"];
  const isActive = listing.status === "active";
  const wilayaLabel = locations.find((location) => location.code === listing.wilayaCode)?.name.ar ?? listing.wilayaName;
  useEffect(() => {
    if (!demo) return;
    const localListing = getLocalMarketplace().listings.find((item) => item.id === listing.id);
    if (localListing) setOwnerPhone(localListing.ownerPhone);
  }, [demo, listing.id]);

  const changeImage = (step: number) => {
    setImageIndex((index) => (index + step + images.length) % images.length);
  };

  const goToLogin = () => router.push(`/login?next=${encodeURIComponent(`/listings/${listing.id}`)}`);

  const loadContact = async () => {
    if (demo) return ownerPhone;
    if (!isAuthenticated) {
      goToLogin();
      return "";
    }
    setContactBusy(true);
    setFeedback({});
    try {
      const result = await getListingOwnerContact(listing.id);
      if (result.loginRequired) {
        goToLogin();
        return "";
      }
      if (result.error) {
        setFeedback({ error: result.error });
        return "";
      }
      setOwnerPhone(result.phoneNumber ?? "");
      return result.phoneNumber ?? "";
    } catch (caught) {
      setFeedback({ error: caught instanceof Error ? caught.message : "تعذر تحميل رقم المالك." });
      return "";
    } finally {
      setContactBusy(false);
    }
  };

  const contactWhatsApp = async () => {
    const phone = await loadContact();
    if (!phone) return;
    const normalized = phone.replace(/\D/g, "");
    const inquiry = language === "en"
      ? `Hello, I am interested in the listing "${listing.title}" on Ekrrili. Is it still available?`
      : language === "fr"
        ? `Bonjour, votre annonce « ${listing.title} » sur Ekrrili m'intéresse. Est-elle toujours disponible ?`
        : `السلام عليكم، أنا مهتم بإعلان «${listing.title}» على اكريلي. هل ما زال متاحاً؟`;
    const url = `https://wa.me/${normalized}?text=${encodeURIComponent(inquiry)}`;
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.location.href = url;
    else window.location.assign(url);
  };

  return (
    <main dir={direction} lang={language} className="min-h-screen bg-[#f7f8f6] pb-[55vh] text-[#17231d] md:pb-10">
      <header className="border-b border-[#e6ebe7] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="text-base font-extrabold tracking-wide text-[#176744]">اكريلي <span dir="ltr" className="text-[10px] tracking-[0.18em] text-[#7d8b81]">EKRRILI</span></Link>
          <Link href="/" className="text-xs font-bold text-[#647168] hover:text-[#176744]">{text.back}</Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-7 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_370px] lg:gap-9 lg:py-9">
        <div className="min-w-0">
          {demo && <div className="mb-4 rounded-xl border border-[#eee1c1] bg-[#fffaf0] px-4 py-2.5 text-xs leading-5 text-[#7a6333]">{text.demo}</div>}
          <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-[#eaf3ec] px-3 py-1.5 font-bold text-[#176744]">{category?.label.ar ?? listing.categoryName}</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 font-semibold text-[#647168]"><MapPin size={13} /> {listing.commune}، {wilayaLabel}</span>
            <span className={cn("rounded-full px-3 py-1.5 font-bold", isActive ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900")}>{isActive ? text.active : listing.status === "paused" ? text.paused : text.unavailable}</span>
            {listing.featured && <span className="rounded-full border border-amber-200 bg-[#fff7df] px-3 py-1.5 font-extrabold text-[#8a641e]">مميز | Featured</span>}
          </div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <ListingSocialActions listingId={listing.id} title={listing.title} dailyPrice={listing.pricePerDay} wilaya={wilayaLabel} demoMode={demo} />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <ReportDisputeModal listingId={listing.id} targetUserId={listing.owner.id} demoMode={demo} reportType="ad" />
              <ReportDisputeModal listingId={listing.id} targetUserId={listing.owner.id} demoMode={demo} reportType="dispute" />
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl bg-[#e9eee9]">
            <div className="relative aspect-[1.35/1] sm:aspect-[1.65/1]">
              <Image src={images[imageIndex]} alt={listing.title} fill priority unoptimized sizes="(max-width: 1024px) 100vw, 65vw" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-black/5" />
              {images.length > 1 && (
                <>
                  <button type="button" aria-label="الصورة السابقة" onClick={() => changeImage(-1)} className="absolute start-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#34483b] shadow"><ChevronRight size={20} /></button>
                  <button type="button" aria-label="الصورة التالية" onClick={() => changeImage(1)} className="absolute end-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#34483b] shadow"><ChevronLeft size={20} /></button>
                  <span className="absolute bottom-3 start-3 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white">{imageIndex + 1} / {images.length}</span>
                </>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto p-3">
                {images.map((image, index) => (
                  <button key={image} type="button" onClick={() => setImageIndex(index)} aria-label={`عرض الصورة ${index + 1}`} aria-pressed={imageIndex === index} className={cn("relative h-16 w-20 shrink-0 overflow-hidden rounded-xl border-2", imageIndex === index ? "border-[#17734e]" : "border-transparent")}>
                    <Image src={image} alt="" fill unoptimized sizes="80px" className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <section className="mt-6 border-b border-[#e5eae6] pb-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-2xl font-extrabold leading-snug sm:text-3xl">{listing.title}</h1>
                <p className="mt-2 flex items-center gap-2 text-sm text-[#7a867e]"><MapPin size={16} /> {listing.commune}، ولاية {wilayaLabel}</p>
              </div>
              <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-2 text-sm font-bold text-[#35463b]">
                <Star size={15} fill="#eab54e" className="text-[#eab54e]" /> {listing.owner.rating.toFixed(1)}
              </div>
            </div>
            <p className="mt-5 whitespace-pre-line text-sm leading-7 text-[#526159]">{listing.description}</p>
          </section>

          <section className="border-b border-[#e5eae6] py-6">
            <div className="rounded-2xl border border-[#e5eae6] bg-white p-4">
              <div className="flex items-center gap-2 font-extrabold"><ShieldCheck size={18} className="text-[#17734e]" /> {text.condition}</div>
              <p className="mt-2 text-sm leading-6 text-[#647168]">{listing.condition || "يتفق الطرفان على حالة الغرض عند التسليم."}</p>
            </div>
            <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <h2 className="text-sm font-extrabold text-emerald-900">{text.handover}</h2>
              <p className="mt-2 text-xs leading-6 text-emerald-900">{text.handoverDescription}</p>
            </div>
          </section>

          <section className="py-6">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-[#17734e]">{text.listingInfo}</p>
                <h2 className="mt-1 text-xl font-extrabold">{text.specifications}</h2>
              </div>
              <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#68756c]">{listing.categoryName}</span>
            </div>
            {metadata.length > 0 ? (
              <dl className="mt-4 grid gap-2 sm:grid-cols-2">
                {metadata.map((item) => (
                  <div key={item.key} className="flex min-w-0 items-start justify-between gap-4 rounded-xl border border-[#e9ede9] bg-white px-4 py-3">
                    <dt className="text-xs text-[#849087]">{item.label}</dt>
                    <dd dir="auto" className="min-w-0 text-end text-sm font-bold text-[#34483b]">{item.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-4 rounded-xl bg-white p-4 text-sm text-[#849087]">{text.noSpecs}</p>
            )}
          </section>

          <section className="mt-2 rounded-2xl border border-[#e4eae5] bg-white p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#eaf3ec] text-lg font-extrabold text-[#176744]">
                {listing.owner.avatarUrl
                  ? <Image src={listing.owner.avatarUrl} alt="" width={56} height={56} unoptimized className="h-full w-full object-cover" />
                  : listing.owner.fullName.slice(0, 1)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-[#859188]">{text.owner}</p>
                <h2 className="mt-1 truncate font-extrabold">{listing.owner.fullName}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[#718077]">
                  <span className="inline-flex items-center gap-1"><Star size={13} fill="#eab54e" className="text-[#eab54e]" /> {listing.owner.rating.toFixed(1)} {text.rating}</span>
                  {listing.owner.identityVerified && <span className="inline-flex items-center gap-1 font-bold text-[#17734e]"><BadgeCheck size={14} /> {text.verified}</span>}
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#edf0ed] pt-4 text-xs">
              <div className="rounded-xl bg-[#f7f9f7] p-3"><span className="block text-[#8a968e]">{text.responseRate}</span><strong className="mt-1 block text-sm text-[#34483b]">{listing.owner.responseRate === null ? (language === "ar" ? "غير متاح" : language === "fr" ? "Indisponible" : "Unavailable") : `${listing.owner.responseRate}%`}</strong></div>
              <div className="rounded-xl bg-[#f7f9f7] p-3"><span className="block text-[#8a968e]">{text.location}</span><strong className="mt-1 block text-sm text-[#34483b]">{wilayaLabel}</strong></div>
            </div>
          </section>
        </div>

        <aside className="hidden lg:block">
          <ContactPanel
            listing={listing}
            ownerIsViewer={ownerIsViewer}
            ownerPhone={ownerPhone}
            contactBusy={contactBusy}
            feedback={feedback}
            onLoadContact={() => void loadContact()}
            onWhatsApp={() => void contactWhatsApp()}
          />
        </aside>
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e0e7e1] bg-white/95 shadow-[0_-10px_35px_rgba(31,55,38,0.12)] backdrop-blur lg:hidden"
        style={{ bottom: "calc(4rem + env(safe-area-inset-bottom) + 1px)" }}
      >
        <ContactPanel
          listing={listing}
          ownerIsViewer={ownerIsViewer}
          ownerPhone={ownerPhone}
          contactBusy={contactBusy}
          feedback={feedback}
          onLoadContact={() => void loadContact()}
          onWhatsApp={() => void contactWhatsApp()}
          compact
        />
      </div>
    </main>
  );
}

function ContactPanel({
  listing,
  ownerIsViewer,
  ownerPhone,
  contactBusy,
  feedback,
  onLoadContact,
  onWhatsApp,
  compact = false,
}: {
  listing: ListingDetailsData;
  ownerIsViewer: boolean;
  ownerPhone: string;
  contactBusy: boolean;
  feedback: { success?: string; error?: string };
  onLoadContact: () => void;
  onWhatsApp: () => void;
  compact?: boolean;
}) {
  const language = useSiteLanguage();
  const text = detailCopy[language];
  const phone = ownerPhone.replace(/[^\d+]/g, "");
  const whatsappNumber = ownerPhone.replace(/\D/g, "");
  const inquiry = language === "en"
    ? `Hello, I am interested in the listing "${listing.title}" on Ekrrili. Is it still available?`
    : language === "fr"
      ? `Bonjour, votre annonce « ${listing.title} » sur Ekrrili m'intéresse. Est-elle toujours disponible ?`
      : `السلام عليكم، أنا مهتم بإعلان «${listing.title}» على اكريلي. هل ما زال متاحاً؟`;

  return (
    <section className={cn("border border-[#e4eae5] bg-white", compact ? "mx-auto max-w-3xl rounded-t-2xl p-3" : "sticky top-6 rounded-3xl p-5 shadow-[0_12px_35px_rgba(31,55,38,0.08)]")}>
      <div className="flex items-end justify-between gap-2">
        <p className={cn("font-extrabold", compact ? "text-lg" : "text-2xl")}>{money.format(listing.pricePerDay)} <span className="text-xs font-semibold text-[#7c8980]">{text.priceDay}</span></p>
        <span className="text-xs text-[#849087]">{text.announcedPrice}</span>
      </div>
      {!compact && listing.pricePerWeek && <p className="mt-2 text-xs font-semibold text-[#176744]">{text.weeklyPrice}: {money.format(listing.pricePerWeek)} {language === "ar" ? "د.ج" : language === "fr" ? "DA" : "DZD"}</p>}
      {!compact && listing.pricePerMonth && <p className="mt-1 text-xs font-semibold text-[#176744]">{text.monthlyPrice}: {money.format(listing.pricePerMonth)} {language === "ar" ? "د.ج" : language === "fr" ? "DA" : "DZD"}</p>}
      <div className="mt-4 rounded-xl border border-[#eee4ce] bg-[#fffaf0] p-3">
        <div className="flex items-center gap-2 text-sm font-extrabold text-[#725a28]"><ShieldCheck size={17} /> {text.caution}</div>
        <p className="mt-1 text-sm font-extrabold text-[#4b3c1f]">{listing.cautionAmount > 0 ? `${money.format(listing.cautionAmount)} ${language === "ar" ? "د.ج" : language === "fr" ? "DA" : "DZD"}` : text.noCaution}</p>
        <p className="mt-1 text-[10px] leading-5 text-[#806f4d]">{text.cautionNote}</p>
      </div>
      {ownerIsViewer ? (
        <p className="mt-3 rounded-lg bg-[#f2f5f2] px-3 py-2 text-center text-[10px] font-semibold text-[#6c796f]">{text.yourListing}</p>
      ) : ownerPhone ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <a href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(inquiry)}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[#16865a] px-2 text-xs font-bold text-white hover:bg-[#116d48]">
            <MessageCircle size={15} /> {text.whatsapp}
          </a>
          <a href={`tel:${phone}`} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-[#e2e8e3] bg-white px-2 text-xs font-bold text-[#4d5e53] hover:bg-[#f7f9f7]">
            <Phone size={15} /> {text.phone}
          </a>
        </div>
      ) : (
        <button type="button" onClick={onLoadContact} disabled={contactBusy || listing.status !== "active"} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#17734e] px-3 text-xs font-bold text-white disabled:opacity-60">
          {contactBusy ? <LoaderCircle size={15} className="animate-spin" /> : <Phone size={15} />}
          {listing.status === "active" ? text.contact : text.notAvailable}
        </button>
      )}
      <Link href="/agreement-demo" className="mt-3 flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#e2e8e3] px-3 text-xs font-bold text-[#526159] hover:bg-[#f7f9f7]">
        <FileText size={15} /> {text.contract}
      </Link>
      <p className="mt-2 rounded-lg bg-[#f5f7f5] p-2 text-[10px] leading-5 text-[#77847b]">{text.contractDisclaimer}</p>
      <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-[10px] leading-5 text-amber-900">{text.platformDisclaimer}</p>
      {feedback.error && <p role="alert" className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-50 p-2 text-[10px] leading-5 text-red-800"><CircleAlert size={13} className="mt-0.5 shrink-0" />{feedback.error}</p>}
      {feedback.success && <p role="status" className="mt-2 flex items-start gap-1.5 rounded-lg bg-emerald-50 p-2 text-[10px] leading-5 text-emerald-800"><Check size={13} className="mt-0.5 shrink-0" />{feedback.success}</p>}
    </section>
  );
}

function demoPhone(listingId: string) {
  const phones: Record<string, string> = {
    "camera-kit": "+213555010101",
    "city-car": "+213555010202",
    "drill-set": "+213555010303",
    "laptop-pro": "+213555010404",
    "event-lighting": "+213555010505",
    "camping-tent": "+213555010606",
    "weekend-home": "+213555010707",
  };
  return phones[listingId] ?? "";
}
