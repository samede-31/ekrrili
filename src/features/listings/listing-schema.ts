import { z } from "zod";
import { categories } from "@/features/listings/listing-options";

const fileSchema = z.custom<File>(
  (value) =>
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "size" in value &&
    "type" in value,
);

const metadataSchema = z.record(z.string(), z.union([z.string(), z.array(z.string())]));

export const listingSchema = z
  .object({
    title: z.string().trim().min(5).max(100),
    description: z.string().trim().min(20).max(3000),
    category: z.enum(["camera", "vehicle", "machinery", "electronics", "event", "camping", "real-estate"]),
    metadata: metadataSchema,
    pricePerDay: z.number().finite().min(0).max(100_000_000),
    pricePerWeek: z.number().finite().min(0).max(700_000_000).optional(),
    pricePerMonth: z.number().finite().min(0).max(3_000_000_000).optional(),
    deliveryAvailable: z.boolean().optional(),
    deliveryFeeDzd: z.number().finite().min(0).max(100_000_000).optional(),
    addons: z.array(z.object({
      name: z.string().trim().min(2).max(80),
      pricePerDayDzd: z.number().finite().min(0).max(100_000_000),
    })).max(20).optional(),
    cautionDepositAmount: z.number().finite().min(0).max(1_000_000_000),
    cautionType: z.enum(["cash", "cheque", "none"]),
    cautionTerms: z.string().trim().max(1000),
    images: z.array(fileSchema).min(1).max(10),
    wilaya: z.string().min(1),
    commune: z.string().trim().min(1).max(100),
  })
  .superRefine((value, context) => {
    if (value.pricePerWeek && value.pricePerWeek > value.pricePerDay * 7) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["pricePerWeek"], message: "Weekly rate must include a discount." });
    }
    if (value.pricePerMonth && value.pricePerMonth > value.pricePerDay * 30) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["pricePerMonth"], message: "Monthly rate must include a discount." });
    }
    if (value.cautionDepositAmount > 0 && value.cautionType === "none") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cautionType"],
        message: "Choose how the caution will be provided.",
      });
    }
    if (value.cautionDepositAmount === 0 && value.cautionType !== "none") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cautionType"],
        message: "Set a caution amount or select no caution.",
      });
    }
    if (value.cautionDepositAmount > 0 && value.cautionTerms.length < 10) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cautionTerms"],
        message: "Explain how and when the caution is returned.",
      });
    }

    const category = categories.find((item) => item.id === value.category);
    for (const field of category?.fields ?? []) {
      if (!field.required) continue;
      const fieldValue = value.metadata[field.name];
      const empty = Array.isArray(fieldValue)
        ? fieldValue.length === 0
        : typeof fieldValue !== "string" || fieldValue.trim() === "";
      if (empty) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["metadata", field.name],
          message: "This field is required.",
        });
      }
      if (field.type === "number" && typeof fieldValue === "string") {
        const numericValue = Number(fieldValue);
        if (!Number.isFinite(numericValue) || numericValue < (field.min ?? 0)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["metadata", field.name],
            message: `Enter a number of at least ${field.min ?? 0}.`,
          });
        }
      }
    }

    for (const [index, image] of value.images.entries()) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(image.type) || image.size > 8 * 1024 * 1024) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["images", index],
          message: "Images must be JPG, PNG, or WebP and no larger than 8 MB.",
        });
      }
    }
  });

export type ListingFormValues = z.infer<typeof listingSchema>;
