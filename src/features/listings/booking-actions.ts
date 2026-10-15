"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  listingId: z.string().uuid(),
  startDate: z.string().date(),
  endDate: z.string().date(),
}).refine((value) => value.startDate < value.endDate, {
  path: ["endDate"],
  message: "Choose a return date after the pick-up date.",
});

const availabilitySchema = requestSchema;

export async function checkListingAvailability(input: {
  listingId: string;
  startDate: string;
  endDate: string;
}) {
  const parsed = availabilitySchema.safeParse(input);
  if (!parsed.success) return { available: false, error: "اختر تاريخي بداية ونهاية صالحين." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("is_listing_available", {
    requested_listing_id: parsed.data.listingId,
    requested_start: parsed.data.startDate,
    requested_end: parsed.data.endDate,
  });
  if (error) return { available: false, error: error.message };
  return { available: data === true };
}

export async function createRentalRequest(input: {
  listingId: string;
  startDate: string;
  endDate: string;
  deliveryMethod: "pickup" | "delivery";
  selectedAddons: Array<{ name: string; price_per_day_dzd: number }>;
}) {
  void input;
  return { error: "اكريلي منصة إعلانات مبوبة فقط؛ يرجى التواصل مباشرة مع المعلن." };
}

export async function getListingOwnerContact(listingId: string) {
  const parsed = z.string().uuid().safeParse(listingId);
  if (!parsed.success) return { error: "الإعلان غير صالح." };

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) return { error: userError.message };
  if (!user) return { loginRequired: true as const };

  const { data, error } = await supabase.rpc("get_listing_contact", {
    requested_listing_id: parsed.data,
  });
  if (error) return { error: error.message };
  if (typeof data !== "string" || !data.trim()) return { error: "لم يضف المالك رقم هاتف للتواصل." };
  return { phoneNumber: data };
}
