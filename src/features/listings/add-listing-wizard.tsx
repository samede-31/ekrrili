"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  ImagePlus,
  MapPin,
  PackagePlus,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch, type FieldPath } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldLabel, Input, Select, Textarea } from "@/components/ui/field";
import {
  categories,
  copy,
  locations,
  type DynamicField,
  type Locale,
} from "@/features/listings/listing-options";
import { listingSchema, type ListingFormValues } from "@/features/listings/listing-schema";
import { addLocalListing } from "@/features/listings/local-marketplace";
import { getSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const initialValues: ListingFormValues = {
  title: "",
  description: "",
  category: "camera",
  metadata: {},
  pricePerDay: 0,
  pricePerWeek: 0,
  pricePerMonth: 0,
  deliveryAvailable: false,
  deliveryFeeDzd: 0,
  addons: [],
  cautionDepositAmount: 0,
  cautionType: "none",
  cautionTerms: "",
  images: [],
  wilaya: "",
  commune: "",
};

const labels: Record<Locale, Record<string, string>> = {
  ar: {
    title: "يرجى إدخال عنوان من 5 إلى 100 حرف.",
    description: "يرجى كتابة وصف من 20 حرفاً على الأقل.",
    category: "اختر فئة الإعلان.",
    pricePerDay: "أدخل سعراً يومياً صالحاً.",
    pricePerWeek: "أدخل سعراً أسبوعياً صالحاً وأقل من السعر اليومي لسبعة أيام.",
    pricePerMonth: "أدخل سعراً شهرياً صالحاً وأقل من السعر اليومي لثلاثين يوماً.",
    deliveryFeeDzd: "أدخل رسوم توصيل صالحة.",
    cautionDepositAmount: "أدخل مبلغ ضمان صالحاً.",
    cautionType: "تحقق من مبلغ الضمان وطريقته.",
    cautionTerms: "اشرح شروط استرجاع الضمان.",
    images: "أضف من صورة واحدة إلى 10 صور صالحة.",
    wilaya: "اختر الولاية.",
    commune: "اختر البلدية أو اكتب اسمها.",
    fallback: "تحقق من المعلومات المدخلة.",
  },
  fr: {
    title: "Saisissez un titre de 5 à 100 caractères.",
    description: "La description doit contenir au moins 20 caractères.",
    category: "Choisissez une catégorie.",
    pricePerDay: "Saisissez un prix journalier valide.",
    pricePerWeek: "Saisissez un prix hebdomadaire inférieur au tarif de sept jours.",
    pricePerMonth: "Saisissez un prix mensuel inférieur au tarif de trente jours.",
    deliveryFeeDzd: "Saisissez des frais de livraison valides.",
    cautionDepositAmount: "Saisissez un montant de caution valide.",
    cautionType: "Vérifiez le montant et le mode de caution.",
    cautionTerms: "Précisez les conditions de restitution.",
    images: "Ajoutez de 1 à 10 images valides.",
    wilaya: "Choisissez une wilaya.",
    commune: "Choisissez une commune ou saisissez son nom.",
    fallback: "Vérifiez les informations saisies.",
  },
};

const stepsIcons = [PackagePlus, ChevronDown, Check, ImagePlus, MapPin];
const numberFormatter = new Intl.NumberFormat("fr-DZ");

function getFieldError(message: string | undefined, locale: Locale) {
  if (!message) return undefined;
  const known = labels[locale][message];
  if (known) return known;
  if (message.startsWith("Enter a number")) {
    return locale === "ar" ? "أدخل رقماً صحيحاً لهذه القيمة." : "Saisissez une valeur numérique valide.";
  }
  if (message.startsWith("Images must")) {
    return locale === "ar" ? copy.ar.imageInvalid : copy.fr.imageInvalid;
  }
  if (message.startsWith("Choose how") || message.startsWith("Set a caution")) {
    return locale === "ar" ? "تحقق من مبلغ الضمان وطريقته." : "Vérifiez le montant et le mode de caution.";
  }
  if (message.startsWith("Explain how")) {
    return locale === "ar" ? "اشرح شروط استرجاع الضمان." : "Précisez les conditions de restitution.";
  }
  return locale === "ar" ? copy.ar.required : copy.fr.required;
}

export function AddListingWizard() {
  const router = useRouter();
  const [locale, setLocale] = useState<Locale>("ar");
  const [step, setStep] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
  const [customCommune, setCustomCommune] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const text = copy[locale];
  const rtl = locale === "ar";
  const direction = rtl ? "rtl" : "ltr";

  const form = useForm<ListingFormValues>({
    resolver: zodResolver(listingSchema),
    mode: "onTouched",
    defaultValues: initialValues,
  });
  const addonFields = useFieldArray({ control: form.control, name: "addons" });
  const categoryId = useWatch({ control: form.control, name: "category" });
  const metadata = useWatch({ control: form.control, name: "metadata" });
  const images = useWatch({ control: form.control, name: "images" }) ?? [];
  const wilayaCode = useWatch({ control: form.control, name: "wilaya" });
  const selectedCategory = categories.find((item) => item.id === categoryId) ?? categories[0];
  const selectedWilaya = locations.find((item) => item.code === wilayaCode);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
  }, [direction, locale]);

  const previewUrls = useMemo(
    () => images.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [images],
  );
  useEffect(() => () => previewUrls.forEach(({ url }) => URL.revokeObjectURL(url)), [previewUrls]);

  const showStepError = (key: string) =>
    getFieldError(stepErrors[key] ?? form.formState.errors[key as keyof ListingFormValues]?.message as string | undefined, locale);

  const validateStep = () => {
    const values = form.getValues();
    const errors: Record<string, string> = {};
    const add = (key: string, invalid: boolean, message = "required") => {
      if (invalid) errors[key] = message;
    };

    if (step === 0) {
      add("title", values.title.trim().length < 5 || values.title.trim().length > 100, "title");
      add("description", values.description.trim().length < 20 || values.description.trim().length > 3000, "description");
      add("category", !categories.some((item) => item.id === values.category), "category");
    } else if (step === 1) {
      for (const field of selectedCategory.fields) {
        const value = values.metadata[field.name];
        const empty = Array.isArray(value) ? value.length === 0 : typeof value !== "string" || !value.trim();
        add(`metadata.${field.name}`, Boolean(field.required && empty));
        if (
          !empty &&
          field.type === "number" &&
          (!Number.isFinite(Number(value)) || Number(value) < (field.min ?? 0))
        ) {
          errors[`metadata.${field.name}`] = "number";
        }
      }
    } else if (step === 2) {
      add(
        "pricePerDay",
        !Number.isFinite(values.pricePerDay) || values.pricePerDay < 0 || values.pricePerDay > 100_000_000,
        "pricePerDay",
      );
      add("pricePerWeek", values.pricePerWeek !== undefined && (!Number.isFinite(values.pricePerWeek) || values.pricePerWeek < 0 || (values.pricePerWeek > 0 && values.pricePerWeek > values.pricePerDay * 7)), "pricePerWeek");
      add("pricePerMonth", values.pricePerMonth !== undefined && (!Number.isFinite(values.pricePerMonth) || values.pricePerMonth < 0 || (values.pricePerMonth > 0 && values.pricePerMonth > values.pricePerDay * 30)), "pricePerMonth");
      add("deliveryFeeDzd", values.deliveryFeeDzd !== undefined && (!Number.isFinite(values.deliveryFeeDzd) || values.deliveryFeeDzd < 0), "deliveryFeeDzd");
      if ((values.addons ?? []).length > 20) errors.addons = "required";
      for (const [index, addon] of (values.addons ?? []).entries()) {
        if (addon.name.trim().length < 2 || addon.name.trim().length > 80 || !Number.isFinite(addon.pricePerDayDzd) || addon.pricePerDayDzd < 0) {
          errors[`addons.${index}.name`] = "required";
        }
      }
      add(
        "cautionDepositAmount",
        !Number.isFinite(values.cautionDepositAmount) || values.cautionDepositAmount < 0 || values.cautionDepositAmount > 1_000_000_000,
        "cautionDepositAmount",
      );
      add(
        "cautionType",
        (values.cautionDepositAmount > 0 && values.cautionType === "none") ||
          (values.cautionDepositAmount === 0 && values.cautionType !== "none"),
        "cautionType",
      );
      add("cautionTerms", values.cautionDepositAmount > 0 && values.cautionTerms.trim().length < 10, "cautionTerms");
    } else if (step === 3) {
      add("images", images.length === 0 || images.length > 10, "images");
      if (images.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024)) {
        errors.images = "images";
      }
    } else {
      add("wilaya", !values.wilaya, "wilaya");
      add("commune", !values.commune.trim(), "commune");
    }

    setStepErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const goNext = () => {
    if (!validateStep()) return;
    setStepErrors({});
    setStep((current) => current + 1);
  };

  const goBack = () => {
    setStepErrors({});
    setStep((current) => Math.max(0, current - 1));
  };

  const addImages = (files: FileList | null) => {
    if (!files) return;
    const existing = form.getValues("images");
    const newFiles = Array.from(files);
    const combined = [...existing, ...newFiles];
    form.setValue("images", combined.slice(0, 10), { shouldValidate: true, shouldDirty: true });
    if (combined.length > 10) setStepErrors({ images: "limit" });
    else setStepErrors({});
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const reorderImage = (index: number, offset: -1 | 1) => {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= images.length) return;
    const reordered = [...images];
    [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
    form.setValue("images", reordered, { shouldValidate: true, shouldDirty: true });
  };

  const submitListing = () => {
    setStepErrors({});
    setPublishError("");
    setReviewing(true);
  };

  const publishListing = async () => {
    if (publishing) return;
    setPublishing(true);
    setPublishError("");
    const values = form.getValues();
    try {
      if (!getSupabasePublicConfig()) {
        const images = await Promise.all(values.images.map(fileToLocalImage));
        if (images.reduce((total, image) => total + image.length, 0) > 1_800_000) {
          throw new Error("حجم الصور الإجمالي كبير للتخزين المحلي. قلّل عدد الصور أو استخدم صوراً أصغر.");
        }
        const listing = addLocalListing({ ...values, images });
        router.push(`/listings/${listing.id}`);
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) {
        router.push(`/login?next=${encodeURIComponent("/list-an-item")}`);
        return;
      }
      const { data: category, error: categoryError } = await supabase
        .from("categories")
        .select("id")
        .eq("slug", values.category)
        .single();
      if (categoryError) throw categoryError;

      const uploadedPaths: string[] = [];
      try {
        const imageUrls: string[] = [];
        for (const file of values.images) {
          const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
          const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
          const { error } = await supabase.storage.from("listing-images").upload(path, file, {
            contentType: file.type,
            upsert: false,
          });
          if (error) throw error;
          uploadedPaths.push(path);
          const { data } = supabase.storage.from("listing-images").getPublicUrl(path);
          imageUrls.push(data.publicUrl);
        }
        const { data: listing, error: insertError } = await supabase.from("listings").insert({
          owner_id: user.id,
          category_id: category.id,
          title: values.title.trim(),
          description: values.description.trim(),
          price_per_day: values.pricePerDay,
          price_per_week: values.pricePerWeek || null,
          price_per_month: values.pricePerMonth || null,
          delivery_available: values.deliveryAvailable,
          delivery_fee_dzd: values.deliveryFeeDzd,
          addons: (values.addons ?? []).map((addon) => ({ name: addon.name, price_per_day_dzd: addon.pricePerDayDzd })),
          caution_deposit_amount: values.cautionDepositAmount,
          caution_type: values.cautionType === "none" ? null : values.cautionType,
          wilaya: values.wilaya,
          commune: values.commune.trim(),
          images: imageUrls,
          metadata: values.metadata,
          item_condition: typeof values.metadata.condition === "string" ? values.metadata.condition : "Not provided",
          status: "active",
        }).select("id").single();
        if (insertError) throw insertError;
        router.push(`/listings/${listing.id}`);
      } catch (error) {
        if (uploadedPaths.length) {
          const { error: cleanupError } = await supabase.storage.from("listing-images").remove(uploadedPaths);
          if (cleanupError) console.error("Could not clean up listing images after a failed publish.", cleanupError);
        }
        throw error;
      }
    } catch (caught) {
      setPublishError(caught instanceof Error ? caught.message : "تعذر نشر الإعلان. حاول مرة أخرى.");
    } finally {
      setPublishing(false);
    }
  };

  const dynamicValue = (field: DynamicField): string | string[] => metadata?.[field.name] ?? (field.type === "checkboxes" ? [] : "");
  const setDynamicValue = (field: DynamicField, value: string | string[]) => {
    form.setValue(`metadata.${field.name}` as FieldPath<ListingFormValues>, value as never, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setStepErrors((current) => {
      const next = { ...current };
      delete next[`metadata.${field.name}`];
      return next;
    });
  };

  return (
    <main dir={direction} className="min-h-screen pb-12">
      <header className="border-b border-[#e5eae5] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <a href="/list-an-item" className="flex items-center gap-2.5" aria-label="Ekrrili">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8f4ec] text-xl">ا</span>
            <span>
              <span className="block text-lg font-extrabold tracking-tight text-[#145b3e]">اكريلي</span>
              <span className="block text-[10px] font-bold tracking-[0.18em] text-[#819086]">EKRRILI</span>
            </span>
          </a>
          <Button variant="outline" size="small" type="button" onClick={() => setLocale(rtl ? "fr" : "ar")}>
            {text.language}
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 pt-8 sm:px-6 sm:pt-12">
        <div className="mb-8 text-center">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-[#17734e]">{text.eyebrow}</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#19271e] sm:text-4xl">{text.title}</h1>
          <p className="mt-3 text-sm leading-6 text-[#69776e]">{text.subtitle}</p>
        </div>

        <nav aria-label={rtl ? "خطوات نشر الإعلان" : "Étapes de publication"} className="mb-8">
          <ol className="grid grid-cols-5 gap-1 sm:gap-3">
            {text.steps.map((stepName, index) => {
              const StepIcon = stepsIcons[index];
              const complete = index < step;
              const active = index === step && !reviewing;
              return (
                <li key={stepName} className="min-w-0">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <span
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full border text-sm transition-colors sm:h-11 sm:w-11",
                        complete || active
                          ? "border-[#17734e] bg-[#17734e] text-white"
                          : "border-[#dfe6e0] bg-white text-[#8a978e]",
                      )}
                    >
                      {complete ? <Check size={17} /> : <StepIcon size={17} />}
                    </span>
                    <span className={cn("line-clamp-2 text-[10px] leading-4 sm:text-xs", active ? "font-bold text-[#175f41]" : "text-[#7d8981]")}>
                      {stepName}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#e6ece7]">
            <div
              className="h-full rounded-full bg-[#17734e] transition-all"
              style={{ width: `${reviewing ? 100 : ((step + 1) / 5) * 100}%` }}
            />
          </div>
        </nav>

        {reviewing ? (
          <Card className="p-5 sm:p-8">
            <div className="mb-6">
              <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e8f4ec] text-[#17734e]">
                <Check size={22} />
              </span>
              <h2 className="text-xl font-bold">{text.previewHeading}</h2>
              <p className="mt-1 text-sm text-[#69776e]">{text.previewDescription}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <PreviewRow label={text.titleLabel} value={form.getValues("title")} />
              <PreviewRow label={text.categoryLabel} value={selectedCategory.label[locale]} />
              {selectedCategory.fields.map((field) => (
                <PreviewRow
                  key={field.name}
                  label={field.label[locale]}
                  value={formatDynamicPreview(field, metadata?.[field.name], locale)}
                />
              ))}
              <PreviewRow label={text.dailyPrice} value={`${numberFormatter.format(form.getValues("pricePerDay"))} ${text.priceUnit}`} />
              <PreviewRow
                label={text.cautionAmount}
                value={`${numberFormatter.format(form.getValues("cautionDepositAmount"))} ${text.dZD}`}
              />
              {form.getValues("cautionDepositAmount") > 0 && (
                <PreviewRow
                  label={text.cautionType}
                  value={form.getValues("cautionType") === "cash" ? text.cash : text.cheque}
                />
              )}
              <PreviewRow label={text.wilaya} value={selectedWilaya?.name[locale] ?? ""} />
              <PreviewRow label={text.commune} value={form.getValues("commune")} />
              {form.getValues("cautionTerms").trim() && (
                <div className="sm:col-span-2">
                  <p className="mb-1 text-xs font-semibold text-[#748078]">{text.cautionTerms}</p>
                  <p className="whitespace-pre-wrap text-sm leading-6">{form.getValues("cautionTerms")}</p>
                </div>
              )}
              <div className="sm:col-span-2">
                <p className="mb-1 text-xs font-semibold text-[#748078]">{text.descriptionLabel}</p>
                <p className="whitespace-pre-wrap text-sm leading-6">{form.getValues("description")}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="mb-2 text-xs font-semibold text-[#748078]">{text.imageHeading}</p>
                <div className="flex flex-wrap gap-2">
                  {previewUrls.map(({ url, file }, index) => (
                    <div key={`${file.name}-${index}`} className="relative h-20 w-20 overflow-hidden rounded-xl">
                      <Image src={url} alt={file.name} fill unoptimized className="object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <p className="mt-6 rounded-xl border border-[#d9e9dd] bg-[#f3faf4] p-4 text-sm leading-6 text-[#42634e]">
              {rtl
                ? getSupabasePublicConfig() ? "سيتم رفع الصور ونشر الإعلان على المنصة." : "سيُحفظ الإعلان والصور في هذا المتصفح بوضع العرض التجريبي."
                : getSupabasePublicConfig() ? "Votre annonce et vos photos seront publiées sur la plateforme." : "L’annonce et les photos seront enregistrées dans ce navigateur en mode démo."}
            </p>
            {publishError && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm leading-6 text-red-800">{publishError}</p>}
            <div className="mt-6 flex flex-col-reverse justify-between gap-3 sm:flex-row">
              <Button variant="outline" type="button" onClick={() => setReviewing(false)}>
                {text.backToEdit}
              </Button>
              <Button type="button" onClick={() => void publishListing()} disabled={publishing}>
                {publishing ? rtl ? "جارٍ النشر..." : "Publication..." : rtl ? "نشر الإعلان" : "Publier l’annonce"}
              </Button>
            </div>
          </Card>
        ) : (
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              if (step === 4) {
                void form.handleSubmit(submitListing)();
                return;
              }

              goNext();
            }}
          >
            <Card className="p-5 sm:p-8">
              {step === 0 && (
                <section>
                  <StepHeading title={text.basicHeading} description={text.basicDescription} />
                  <div className="space-y-5">
                    <div>
                      <FieldLabel htmlFor="title" required>{text.titleLabel}</FieldLabel>
                      <Input
                        id="title"
                        maxLength={100}
                        placeholder={text.titlePlaceholder}
                        aria-invalid={Boolean(showStepError("title"))}
                        {...form.register("title")}
                      />
                      {showStepError("title") && <ErrorText>{showStepError("title")}</ErrorText>}
                    </div>
                    <div>
                      <FieldLabel htmlFor="description" required>{text.descriptionLabel}</FieldLabel>
                      <Textarea
                        id="description"
                        maxLength={3000}
                        placeholder={text.descriptionPlaceholder}
                        aria-invalid={Boolean(showStepError("description"))}
                        {...form.register("description")}
                      />
                      <div className="mt-1 flex justify-between gap-2 text-xs text-[#909b93]">
                        {showStepError("description") ? <ErrorText>{showStepError("description")}</ErrorText> : <span />}
                        <span>{form.watch("description").length}/3000</span>
                      </div>
                    </div>
                    <div>
                      <FieldLabel htmlFor="category" required>{text.categoryLabel}</FieldLabel>
                      <Controller
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <Select
                            id="category"
                            value={field.value}
                            onChange={(event) => {
                              field.onChange(event);
                              form.setValue("metadata", {});
                            }}
                          >
                            <option value="" disabled>{text.chooseCategory}</option>
                            {categories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.icon} {category.label[locale]}
                              </option>
                            ))}
                          </Select>
                        )}
                      />
                      {showStepError("category") && <ErrorText>{showStepError("category")}</ErrorText>}
                    </div>
                  </div>
                </section>
              )}

              {step === 1 && (
                <section>
                  <StepHeading title={text.detailsHeading} description={text.detailsDescription} />
                  <div className="mb-5 flex items-center gap-3 rounded-xl bg-[#f3f7f3] p-4">
                    <span className="text-2xl">{selectedCategory.icon}</span>
                    <div>
                      <p className="text-sm font-bold">{selectedCategory.label[locale]}</p>
                      <p className="text-xs text-[#738078]">{text.detailsHeading}</p>
                    </div>
                  </div>
                  {selectedCategory.fields.length === 0 ? (
                    <p className="text-sm text-[#69776e]">{text.noDynamicFields}</p>
                  ) : (
                    <div className="grid gap-5 sm:grid-cols-2">
                      {selectedCategory.fields.map((field) => (
                        <DynamicFieldControl
                          key={`${categoryId}-${field.name}`}
                          field={field}
                          locale={locale}
                          value={dynamicValue(field)}
                          error={showStepError(`metadata.${field.name}`)}
                          onChange={(value) => setDynamicValue(field, value)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )}

              {step === 2 && (
                <section>
                  <StepHeading title={text.pricingHeading} description={text.pricingDescription} />
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <FieldLabel htmlFor="pricePerDay" required>{text.dailyPrice}</FieldLabel>
                      <div className="relative">
                        <Input
                          id="pricePerDay"
                          type="number"
                          min="0"
                          step="100"
                          inputMode="decimal"
                          aria-invalid={Boolean(showStepError("pricePerDay"))}
                          {...form.register("pricePerDay", { valueAsNumber: true })}
                        />
                        <span className={cn("pointer-events-none absolute top-1/2 -translate-y-1/2 text-xs font-semibold text-[#8a968e]", rtl ? "left-4" : "right-4")}>
                          {text.dZD}
                        </span>
                      </div>
                      {showStepError("pricePerDay") && <ErrorText>{showStepError("pricePerDay")}</ErrorText>}
                    </div>
                    <div>
                      <FieldLabel htmlFor="pricePerWeek">سعر الأسبوع (اختياري)</FieldLabel>
                      <Input id="pricePerWeek" type="number" min="0" step="100" {...form.register("pricePerWeek", { valueAsNumber: true })} />
                      {showStepError("pricePerWeek") && <ErrorText>{showStepError("pricePerWeek")}</ErrorText>}
                      <p className="mt-1 text-xs text-[#738078]">يُطبّق عند الكراء لمدة 7 أيام فأكثر.</p>
                    </div>
                    <div>
                      <FieldLabel htmlFor="pricePerMonth">سعر الشهر (اختياري)</FieldLabel>
                      <Input id="pricePerMonth" type="number" min="0" step="100" {...form.register("pricePerMonth", { valueAsNumber: true })} />
                      {showStepError("pricePerMonth") && <ErrorText>{showStepError("pricePerMonth")}</ErrorText>}
                      <p className="mt-1 text-xs text-[#738078]">يُطبّق عند الكراء لمدة 30 يوماً فأكثر.</p>
                    </div>
                    <div className="sm:col-span-2 rounded-2xl border border-[#e4eae5] p-4">
                      <label className="flex items-center gap-3 text-sm font-bold">
                        <input type="checkbox" {...form.register("deliveryAvailable")} className="h-4 w-4 accent-[#17734e]" />
                        التوصيل متاح
                      </label>
                      {form.watch("deliveryAvailable") && (
                        <div className="mt-3 max-w-xs">
                          <FieldLabel htmlFor="deliveryFeeDzd">رسوم التوصيل (د.ج)</FieldLabel>
                          <Input id="deliveryFeeDzd" type="number" min="0" step="100" {...form.register("deliveryFeeDzd", { valueAsNumber: true })} />
                          {showStepError("deliveryFeeDzd") && <ErrorText>{showStepError("deliveryFeeDzd")}</ErrorText>}
                        </div>
                      )}
                    </div>
                    <div className="sm:col-span-2 rounded-2xl border border-[#e4eae5] p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <strong className="text-sm">الملحقات الإضافية</strong>
                        <Button type="button" variant="outline" size="small" onClick={() => addonFields.append({ name: "", pricePerDayDzd: 0 })}>إضافة ملحق</Button>
                      </div>
                      <div className="grid gap-3">
                        {addonFields.fields.map((field, index) => (
                          <div key={field.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                            <Input aria-label="اسم الملحق" placeholder="مثال: بطارية إضافية" {...form.register(`addons.${index}.name`)} />
                            <Input aria-label="سعر الملحق اليومي" type="number" min="0" placeholder="السعر اليومي (د.ج)" {...form.register(`addons.${index}.pricePerDayDzd`, { valueAsNumber: true })} />
                            <Button type="button" variant="ghost" size="small" onClick={() => addonFields.remove(index)}>حذف</Button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <FieldLabel htmlFor="cautionDepositAmount">{text.cautionAmount}</FieldLabel>
                      <div className="relative">
                        <Input
                          id="cautionDepositAmount"
                          type="number"
                          min="0"
                          step="100"
                          inputMode="decimal"
                          aria-invalid={Boolean(showStepError("cautionDepositAmount"))}
                          {...form.register("cautionDepositAmount", { valueAsNumber: true })}
                        />
                        <span className={cn("pointer-events-none absolute top-1/2 -translate-y-1/2 text-xs font-semibold text-[#8a968e]", rtl ? "left-4" : "right-4")}>
                          {text.dZD}
                        </span>
                      </div>
                      {showStepError("cautionDepositAmount") && <ErrorText>{showStepError("cautionDepositAmount")}</ErrorText>}
                    </div>
                    <div>
                      <FieldLabel htmlFor="cautionType">{text.cautionType}</FieldLabel>
                      <Controller
                        control={form.control}
                        name="cautionType"
                        render={({ field }) => (
                          <Select id="cautionType" value={field.value} onChange={field.onChange}>
                            <option value="none">{text.noCaution}</option>
                            <option value="cash">{text.cash}</option>
                            <option value="cheque">{text.cheque}</option>
                          </Select>
                        )}
                      />
                      {showStepError("cautionType") && <ErrorText>{showStepError("cautionType")}</ErrorText>}
                    </div>
                    {form.watch("cautionDepositAmount") > 0 && (
                      <div className="sm:col-span-2">
                        <FieldLabel htmlFor="cautionTerms" required>{text.cautionTerms}</FieldLabel>
                        <Textarea
                          id="cautionTerms"
                          maxLength={1000}
                          placeholder={text.cautionPlaceholder}
                          aria-invalid={Boolean(showStepError("cautionTerms"))}
                          {...form.register("cautionTerms")}
                        />
                        {showStepError("cautionTerms") && <ErrorText>{showStepError("cautionTerms")}</ErrorText>}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {step === 3 && (
                <section>
                  <StepHeading title={text.imageHeading} description={text.imageDescription} />
                  <input
                    ref={imageInputRef}
                    className="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={(event) => addImages(event.currentTarget.files)}
                    aria-label={text.addImages}
                  />
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="flex min-h-44 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#cbd9ce] bg-[#f8fbf8] px-4 text-center transition hover:border-[#17734e] hover:bg-[#f1f8f3]"
                  >
                    <ImagePlus size={29} className="mb-3 text-[#17734e]" />
                    <span className="text-sm font-bold">{text.addImages}</span>
                    <span className="mt-1 text-xs text-[#7a887f]">{text.imageTypes}</span>
                  </button>
                  {showStepError("images") && <ErrorText>{stepErrors.images === "limit" ? text.imageLimit : text.imageInvalid}</ErrorText>}
                  {images.length > 0 && (
                    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {previewUrls.map(({ file, url }, index) => (
                        <div key={`${file.name}-${file.size}-${index}`} className="overflow-hidden rounded-xl border border-[#e3e9e4] bg-white">
                          <div className="relative aspect-[4/3] bg-[#eff3ef]">
                            <Image src={url} alt={file.name} fill unoptimized className="object-cover" />
                            {index === 0 && (
                              <span className="absolute start-2 top-2 rounded-full bg-white/95 px-2 py-1 text-[10px] font-bold text-[#24563c]">
                                {text.mainImage}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between gap-1 p-2">
                            <span className="min-w-0 flex-1 truncate text-[11px] text-[#526158]" title={file.name}>{file.name}</span>
                            <div className="flex shrink-0 gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={index === 0}
                                aria-label={text.moveLeft}
                                onClick={() => reorderImage(index, -1)}
                              >
                                <ArrowUp size={15} />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={index === images.length - 1}
                                aria-label={text.moveRight}
                                onClick={() => reorderImage(index, 1)}
                              >
                                <ArrowDown size={15} />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-[#ad4e47] hover:bg-[#fff1ef]"
                                aria-label={text.removeImage}
                                onClick={() => form.setValue("images", images.filter((_, imageIndex) => imageIndex !== index), { shouldValidate: true, shouldDirty: true })}
                              >
                                <Trash2 size={14} />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {step === 4 && (
                <section>
                  <StepHeading title={text.locationHeading} description={text.locationDescription} />
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <FieldLabel htmlFor="wilaya" required>{text.wilaya}</FieldLabel>
                      <Controller
                        control={form.control}
                        name="wilaya"
                        render={({ field }) => (
                          <Select
                            id="wilaya"
                            value={field.value}
                            onChange={(event) => {
                              field.onChange(event);
                              form.setValue("commune", "");
                              setCustomCommune(false);
                            }}
                          >
                            <option value="">{text.chooseWilaya}</option>
                            {locations.map((location) => (
                              <option key={location.code} value={location.code}>
                                {location.code} · {location.name[locale]}
                              </option>
                            ))}
                          </Select>
                        )}
                      />
                      {showStepError("wilaya") && <ErrorText>{showStepError("wilaya")}</ErrorText>}
                    </div>
                    <div>
                      <FieldLabel htmlFor="commune" required>{text.commune}</FieldLabel>
                      <Controller
                        control={form.control}
                        name="commune"
                        render={({ field }) => (
                          <Select
                            id="commune"
                            value={customCommune ? "__other__" : field.value}
                            disabled={!selectedWilaya}
                            onChange={(event) => {
                              const isOther = event.target.value === "__other__";
                              setCustomCommune(isOther);
                              field.onChange(isOther ? "" : event.target.value);
                            }}
                          >
                            <option value="">{text.chooseCommune}</option>
                            {selectedWilaya?.communes.map((commune) => (
                              <option key={commune} value={commune}>{commune}</option>
                            ))}
                            <option value="__other__">{text.otherCommune}</option>
                          </Select>
                        )}
                      />
                      {customCommune && (
                        <Input
                          className="mt-3"
                          aria-label={text.otherCommuneLabel}
                          placeholder={text.otherCommuneLabel}
                          value={form.watch("commune")}
                          onChange={(event) => form.setValue("commune", event.target.value, { shouldDirty: true })}
                        />
                      )}
                      {showStepError("commune") && <ErrorText>{showStepError("commune")}</ErrorText>}
                    </div>
                  </div>
                  <p className="mt-5 rounded-xl bg-[#f4f7f4] p-3 text-xs leading-5 text-[#738078]">
                    {rtl
                      ? "تظهر البلديات الشائعة لكل ولاية. إذا لم تجد بلديتك، اختر «بلدية أخرى» واكتب اسمها."
                      : "Les communes courantes sont proposées. Si la vôtre n'apparaît pas, choisissez « Autre commune » et saisissez son nom."}
                  </p>
                </section>
              )}

              <div className="mt-8 flex flex-col-reverse justify-between gap-3 border-t border-[#edf0ed] pt-5 sm:flex-row">
                {step > 0 ? (
                  <Button type="button" variant="outline" onClick={goBack}>
                    {rtl ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
                    {text.previous}
                  </Button>
                ) : <span />}
                <Button type="submit">
                  {step === 4 ? text.review : text.next}
                  {rtl ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
                </Button>
              </div>
            </Card>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-[#929c95]">
          {text.stepLabel} {reviewing ? 5 : step + 1} {text.of} 5
        </p>
      </div>
    </main>
  );
}

function StepHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-bold text-[#203128]">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-[#738078]">{description}</p>
    </div>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return <p role="alert" className="mt-1.5 text-xs font-medium text-[#bd463d]">{children}</p>;
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-[#748078]">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function formatDynamicPreview(field: DynamicField, value: string | string[] | undefined, locale: Locale) {
  if (value === undefined || value === "") return "—";
  const values = Array.isArray(value) ? value : [value];
  return values
    .map((item) => field.options?.find((option) => option.value === item)?.label[locale] ?? item)
    .join(locale === "ar" ? "، " : ", ");
}

function DynamicFieldControl({
  field,
  locale,
  value,
  error,
  onChange,
}: {
  field: DynamicField;
  locale: Locale;
  value: string | string[];
  error?: string;
  onChange: (value: string | string[]) => void;
}) {
  const id = `metadata-${field.name}`;
  return (
    <div className={field.type === "checkboxes" ? "sm:col-span-2" : ""}>
      <FieldLabel htmlFor={id} required={field.required}>{field.label[locale]}</FieldLabel>
      {field.type === "select" ? (
        <Select id={id} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)}>
          <option value="">—</option>
          {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label[locale]}</option>)}
        </Select>
      ) : field.type === "checkboxes" ? (
        <div className="grid gap-2 rounded-xl border border-[#dbe4dd] p-3 sm:grid-cols-2">
          {field.options?.map((option) => {
            const selected = Array.isArray(value) && value.includes(option.value);
            return (
              <label key={option.value} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm hover:bg-[#f4f7f4]">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(event) => {
                    const current = Array.isArray(value) ? value : [];
                    onChange(event.target.checked ? [...current, option.value] : current.filter((item) => item !== option.value));
                  }}
                  className="h-4 w-4 accent-[#17734e]"
                />
                {option.label[locale]}
              </label>
            );
          })}
        </div>
      ) : (
        <Input
          id={id}
          type={field.type}
          min={field.type === "number" ? field.min ?? 0 : undefined}
          step={field.type === "number" ? "1" : undefined}
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
          placeholder={field.placeholder?.[locale]}
        />
      )}
      {error && <ErrorText>{error === "number" ? (locale === "ar" ? "أدخل رقماً صالحاً." : "Saisissez un nombre valide.") : error}</ErrorText>}
    </div>
  );
}

async function fileToLocalImage(file: File): Promise<string> {
  const image = await createImageBitmap(file);
  try {
    const maxEdge = 1024;
    const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("تعذر تجهيز الصورة للتخزين المحلي.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
    if (dataUrl.length > 300_000) throw new Error("الصورة كبيرة للتخزين المحلي. اختر صورة أصغر أو استخدم Supabase.");
    return dataUrl;
  } finally {
    image.close();
  }
}
