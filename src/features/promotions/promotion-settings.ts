export type PromotionPlan = {
  id: "plan_7d" | "plan_15d" | "plan_30d";
  name: string;
  duration_days: number;
  amount_dzd: number;
  amount_usd: number;
  enabled: boolean;
};

export type PromotionPromoCode = {
  code: string;
  duration_days: 7 | 14;
  active: boolean;
  max_uses: number | null;
  redeemed_count: number;
  redeemed_by?: string[];
};

export type PromotionPaymentSettings = {
  ccp_account_number: string;
  ccp_key: string;
  baridimob_rip: string;
  account_holder_name: string;
  support_phone: string;
  bybit_uid: string;
  bybit_pay_qr_url: string;
  usdt_wallet_address: string;
  promotion_plans: PromotionPlan[];
  promo_codes: PromotionPromoCode[];
};

export const defaultPromotionPaymentSettings: PromotionPaymentSettings = {
  ccp_account_number: "",
  ccp_key: "",
  baridimob_rip: "",
  account_holder_name: "",
  support_phone: "",
  bybit_uid: "",
  bybit_pay_qr_url: "",
  usdt_wallet_address: "",
  promo_codes: [],
  promotion_plans: [
    { id: "plan_7d", name: "باقة 7 أيام - أسبوع", duration_days: 7, amount_dzd: 300, amount_usd: 1.5, enabled: true },
    { id: "plan_15d", name: "خطة 15 يوم", duration_days: 15, amount_dzd: 600, amount_usd: 3, enabled: true },
    { id: "plan_30d", name: "خطة 30 يوم - شهر كامل", duration_days: 30, amount_dzd: 1000, amount_usd: 5, enabled: true },
  ],
};
