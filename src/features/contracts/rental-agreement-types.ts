export type RentalAgreementData = {
  contractId: string;
  generatedAt: string;
  status: "pending" | "approved" | "active" | "completed" | "cancelled";
  owner: {
    fullName: string;
    phoneNumber: string;
  };
  renter: {
    fullName: string;
    phoneNumber: string;
  };
  item: {
    title: string;
    condition: string;
    accessories: string[];
  };
  caution: {
    amountDzd: number;
    type: "cash" | "cheque" | null;
    reimbursementTerms: string;
  };
  rental: {
    pickupAt: string;
    returnAt: string;
    totalCostDzd: number;
    damageTerms: string;
    lateReturnTerms: string;
    deliveryMethod?: "pickup" | "delivery";
    deliveryFeeDzd?: number;
    selectedAddons?: Array<{ name: string; price_per_day_dzd: number }>;
  };
};
