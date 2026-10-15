import type { ReactNode } from "react";
import type { RentalAgreementData } from "@/features/contracts/rental-agreement-types";
import { ContractVerificationQr } from "@/features/contracts/contract-verification-qr";

const agreementDate = (locale: "ar" | "en" | "fr") => new Intl.DateTimeFormat(
  locale === "ar" ? "ar-DZ" : locale === "fr" ? "fr-DZ" : "en-GB",
  {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Africa/Algiers",
  },
);

function formatDateTime(value: string, locale: "ar" | "en" | "fr") {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : agreementDate(locale).format(date);
}

function formatDzd(value: number) {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)} د.ج`;
}

function BidiValue({ children }: { children: ReactNode }) {
  return <span dir="ltr" className="agreement-ltr">{children}</span>;
}

function BidiMixedText({ value }: { value: string }) {
  const chunks = value.split(/([A-Za-z0-9][A-Za-z0-9.+/_-]*)/g);
  return (
    <>
      {chunks.map((chunk, index) =>
        /[A-Za-z0-9]/.test(chunk)
          ? <BidiValue key={`${index}-${chunk}`}>{chunk}</BidiValue>
          : <span key={`${chunk}-${index}`}>{chunk}</span>,
      )}
    </>
  );
}

function AgreementField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="agreement-field">
      <span className="agreement-field-label">{label}</span>
      <span className="agreement-field-value">{children}</span>
    </div>
  );
}

function PartyCard({
  heading,
  person,
  labels,
}: {
  heading: string;
  person: RentalAgreementData["owner"];
  labels: {
    fullName: string;
    phone: string;
    nationalId: string;
    idAtHandover: string;
  };
}) {
  return (
    <section className="agreement-party-card">
      <h3>{heading}</h3>
      <AgreementField label={labels.fullName}>{person.fullName}</AgreementField>
      <AgreementField label={labels.phone}><BidiValue>{person.phoneNumber || "—"}</BidiValue></AgreementField>
      <AgreementField label={labels.nationalId}>
        <span className="agreement-id-placeholder">{labels.idAtHandover}</span>
      </AgreementField>
    </section>
  );
}

const agreementText = {
  ar: {
    contract: "رقم العقد", created: "تاريخ الإنشاء", title: "نموذج اتفاق خاص بين الأفراد",
    subtitle: "نموذج استرشادي اختياري — يُراجع ويُطبع ويُوقّع مباشرة بين الطرفين",
    parties: "الأطراف المتعاقدة", owner: "الطرف الأول - المالك", renter: "الطرف الثاني - المستأجر",
    fullName: "الاسم الكامل", phone: "رقم الهاتف", nationalId: "رقم بطاقة التعريف الوطنية",
    idAtHandover: "يُستكمل عند التسليم الحضوري", item: "تفاصيل الغرض المؤجر",
    rentedItem: "الغرض المؤجر", condition: "الحالة عند التسليم", accessories: "الملحقات المرفقة",
    noAccessories: "لا توجد ملحقات مسجلة", rental: "فترة الإيجار والتكلفة والضمان",
    pickup: "موعد الاستلام", return: "موعد الإرجاع", total: "إجمالي تكلفة الكراء",
    delivery: "طريقة الاستلام والتوصيل", deliveryFee: "توصيل", pickupFree: "استلام حضوري مجاناً",
    addons: "الملحقات الإضافية", perDay: "يوم", caution: "مبلغ وطريقة الضمان (Caution)",
    cash: "نقداً", cheque: "شيك", noDeposit: "بدون ضمان", terms: "الشروط والأحكام",
    damage: "المسؤولية عن الضرر", late: "التأخير في الإرجاع", reimbursement: "استرجاع مبلغ الضمان",
    signatures: "التوقيعات عند التسليم الحضوري", ownerSignature: "توقيع المالك",
    renterSignature: "توقيع المستأجر", legal: "هذا العقد نموذج استرشادي اختياري ولا تتحمل منصة اكريلي أي مسؤولية قانونية عنه. يراجع الطرفان محتواه ويوقعانه فيما بينهما، وتبقى المنصة خارج أي اتفاق أو تعامل.",
  },
  en: {
    contract: "Agreement ID", created: "Created", title: "Private Agreement Between Individuals",
    subtitle: "Optional reference template — review, print, and sign directly between the parties",
    parties: "Contracting Parties", owner: "Party One - Owner", renter: "Party Two - Renter",
    fullName: "Full name", phone: "Phone number", nationalId: "National ID number",
    idAtHandover: "To be completed during in-person handover", item: "Rental Item Details",
    rentedItem: "Rental item", condition: "Condition at handover", accessories: "Included accessories",
    noAccessories: "No accessories listed", rental: "Rental Period, Cost and Deposit",
    pickup: "Pickup time", return: "Return time", total: "Total rental cost",
    delivery: "Pickup and delivery method", deliveryFee: "Delivery", pickupFree: "Free in-person pickup",
    addons: "Optional add-ons", perDay: "day", caution: "Deposit amount and method",
    cash: "Cash", cheque: "Cheque", noDeposit: "No deposit", terms: "Terms and Conditions",
    damage: "Damage responsibility", late: "Late return", reimbursement: "Deposit reimbursement",
    signatures: "Signatures at In-Person Handover", ownerSignature: "Owner signature",
    renterSignature: "Renter signature", legal: "This is an optional reference template. Ekrrili accepts no legal responsibility for it. The parties should review and sign it between themselves; the platform is not a party to any agreement or transaction.",
  },
  fr: {
    contract: "N° du contrat", created: "Date de création", title: "Accord privé entre particuliers",
    subtitle: "Modèle facultatif — à vérifier, imprimer et signer directement entre les parties",
    parties: "Parties contractantes", owner: "Première partie - Propriétaire", renter: "Deuxième partie - Locataire",
    fullName: "Nom complet", phone: "Numéro de téléphone", nationalId: "Numéro de carte d'identité",
    idAtHandover: "À compléter lors de la remise en main propre", item: "Détails de l'objet loué",
    rentedItem: "Objet loué", condition: "État lors de la remise", accessories: "Accessoires inclus",
    noAccessories: "Aucun accessoire indiqué", rental: "Période, coût et caution",
    pickup: "Date de remise", return: "Date de retour", total: "Coût total de location",
    delivery: "Mode de remise et livraison", deliveryFee: "Livraison", pickupFree: "Retrait gratuit en personne",
    addons: "Options supplémentaires", perDay: "jour", caution: "Montant et mode de la caution",
    cash: "Espèces", cheque: "Chèque", noDeposit: "Sans caution", terms: "Conditions générales",
    damage: "Responsabilité en cas de dommage", late: "Retard de retour", reimbursement: "Remboursement de la caution",
    signatures: "Signatures lors de la remise en main propre", ownerSignature: "Signature du propriétaire",
    renterSignature: "Signature du locataire", legal: "Ce document est un modèle facultatif. Ekrrili décline toute responsabilité juridique à son égard. Les parties doivent le vérifier et le signer entre elles ; la plateforme n'est partie à aucun accord ni transaction.",
  },
} as const;

export function RentalAgreementPrintable({
  agreement,
  verificationId,
  locale = "ar",
}: {
  agreement: RentalAgreementData;
  verificationId?: string;
  locale?: "ar" | "en" | "fr";
}) {
  const labels = agreementText[locale];
  const cautionType = agreement.caution.type === "cash"
    ? labels.cash
    : agreement.caution.type === "cheque"
      ? labels.cheque
      : labels.noDeposit;
  const accessories = agreement.item.accessories.length
    ? agreement.item.accessories
    : [labels.noAccessories];
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <article id="rental-agreement" className="rental-agreement-sheet" dir={direction} lang={locale}>
      <header className="agreement-header">
        <div className="agreement-brand" aria-label="اكريلي EKRILLI">
          <span className="agreement-brand-mark">ا</span>
          <span>
            <strong>اكريلي</strong>
            <small>EKRILLI</small>
          </span>
        </div>
        <div className="agreement-meta">
          <p>{labels.contract}: <BidiValue>{agreement.contractId}</BidiValue></p>
          <p>{labels.created}: <time dateTime={agreement.generatedAt} dir="ltr" className="agreement-ltr">{formatDateTime(agreement.generatedAt, locale)}</time></p>
        </div>
      </header>

      <div className="agreement-title-banner">
        <h1>{labels.title}</h1>
        <p>{labels.subtitle}</p>
      </div>

      <section className="agreement-section">
        <h2>١. {labels.parties}</h2>
        <div className="agreement-party-grid">
          <PartyCard heading={labels.owner} person={agreement.owner} labels={labels} />
          <PartyCard heading={labels.renter} person={agreement.renter} labels={labels} />
        </div>
      </section>

      <section className="agreement-section">
        <h2>٢. {labels.item}</h2>
        <div className="agreement-item-grid">
          <AgreementField label={labels.rentedItem}>
            <BidiMixedText value={agreement.item.title} />
          </AgreementField>
          <AgreementField label={labels.condition}><BidiMixedText value={agreement.item.condition} /></AgreementField>
          <AgreementField label={labels.accessories}>
            {accessories.map((accessory, index) => (
              <span key={`${accessory}-${index}`}>
                {index > 0 && "، "}
                <BidiMixedText value={accessory} />
              </span>
            ))}
          </AgreementField>
        </div>
      </section>

      <section className="agreement-section">
        <h2>٣. {labels.rental}</h2>
        <div className="agreement-summary-grid">
          <AgreementField label={labels.pickup}>
            <time dateTime={agreement.rental.pickupAt} dir="ltr" className="agreement-ltr">{formatDateTime(agreement.rental.pickupAt, locale)}</time>
          </AgreementField>
          <AgreementField label={labels.return}>
            <time dateTime={agreement.rental.returnAt} dir="ltr" className="agreement-ltr">{formatDateTime(agreement.rental.returnAt, locale)}</time>
          </AgreementField>
          <AgreementField label={labels.total}>
            <BidiValue>{formatDzd(agreement.rental.totalCostDzd)}</BidiValue>
          </AgreementField>
          <AgreementField label={labels.delivery}>
            {agreement.rental.deliveryMethod === "delivery"
              ? `${labels.deliveryFee} · ${formatDzd(agreement.rental.deliveryFeeDzd ?? 0)}`
              : labels.pickupFree}
          </AgreementField>
          {(agreement.rental.selectedAddons?.length ?? 0) > 0 && (
            <AgreementField label={labels.addons}>
              {agreement.rental.selectedAddons?.map((addon) => `${addon.name} (+${formatDzd(addon.price_per_day_dzd)} / ${labels.perDay})`).join("، ")}
            </AgreementField>
          )}
          <AgreementField label={labels.caution}>
            <BidiValue>{formatDzd(agreement.caution.amountDzd)}</BidiValue>
            {" · "}
            {cautionType}
          </AgreementField>
        </div>
      </section>

      <section className="agreement-section agreement-terms">
        <h2>٤. {labels.terms}</h2>
        <ul>
          <li><strong>{labels.damage}:</strong> <BidiMixedText value={agreement.rental.damageTerms} /></li>
          <li><strong>{labels.late}:</strong> <BidiMixedText value={agreement.rental.lateReturnTerms} /></li>
          <li><strong>{labels.reimbursement}:</strong> <BidiMixedText value={agreement.caution.reimbursementTerms} /></li>
        </ul>
      </section>

      <section className="agreement-signatures">
        <h2>٥. {labels.signatures}</h2>
        <div className="agreement-signature-grid">
          <SignatureBox title={labels.ownerSignature} />
          <SignatureBox title={labels.renterSignature} />
        </div>
      </section>

      {verificationId && <ContractVerificationQr requestId={verificationId} />}

      <footer className="agreement-footer">
        {labels.legal}
      </footer>
    </article>
  );
}

function SignatureBox({ title }: { title: string }) {
  return (
    <div className="agreement-signature-box">
      <strong>{title}</strong>
      <div className="agreement-signature-line">
        <span>التاريخ:</span>
        <span className="agreement-date-line" aria-hidden="true" />
      </div>
      <div className="agreement-signature-line">
        <span>التوقيع:</span>
        <span className="agreement-date-line" aria-hidden="true" />
      </div>
    </div>
  );
}
