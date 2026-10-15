# Ekrrili (اكريلي) — Project Specification

## Product overview

Ekrrili is a peer-to-peer rental marketplace where people in Algeria can list,
discover, and rent goods and spaces. The marketplace supports tools and
equipment, electronics and cameras, vehicles, event supplies, camping gear, and
real estate. Its core experience combines searchable listings, availability and
booking management, clear caution (deposit) terms, trust signals, bilateral
reviews, and a downloadable rental agreement.

The product should be designed for mobile first and prepared for Arabic
(right-to-left) and French localization. Wilaya and commune are first-class
location fields; prices should support DZD.

## Proposed project structure

```text
ekrrili/
├── public/
│   ├── fonts/
│   └── images/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (marketplace)/
│   │   │   ├── listings/
│   │   │   ├── categories/[slug]/
│   │   │   └── page.tsx
│   │   ├── dashboard/
│   │   │   └── contracts/[id]/
│   │   ├── bookings/[id]/
│   │   ├── listings/[id]/
│   │   ├── list-an-item/
│   │   ├── api/
│   │   │   └── bookings/[id]/contract/
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                 # Shadcn/UI components
│   │   ├── listings/
│   │   ├── booking/
│   │   ├── search/
│   │   └── shared/
│   ├── features/
│   │   ├── auth/
│   │   ├── listings/
│   │   ├── bookings/
│   │   ├── reviews/
│   │   └── identity/
│   ├── lib/
│   │   ├── supabase/
│   │   ├── validations/
│   │   ├── permissions/
│   │   ├── contracts/
│   │   └── utils.ts
│   ├── types/
│   └── middleware.ts
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── config.toml
├── tests/
│   ├── unit/
│   └── e2e/
├── components.json
├── next.config.ts
├── postcss.config.mjs
├── tsconfig.json
└── package.json
```

This is a target structure, not a requirement to create every directory up
front. Keep feature-specific UI and business logic close to its feature; place
shared primitives and infrastructure in `components/` and `lib/`.

## System architecture

### Web application

- Next.js App Router with TypeScript; server components for read-heavy pages and
  server actions or route handlers for trusted mutations and document delivery.
- Tailwind CSS and Shadcn/UI for responsive, accessible UI; Lucide React for
  icons.
- Arabic RTL and French-ready layouts and text. Keep locale-sensitive labels,
  formatting, and direction out of business logic.
- The root layout provides an Arabic RTL installable PWA manifest, standalone
  Android display settings, safe-area-aware four-tab mobile navigation, and an
  offline fallback. Public static assets are cached; authenticated pages and
  their data are deliberately never cached. The web build can be packaged as an
  Android Trusted Web Activity once deployed on HTTPS with a verified domain.
- Zod schemas validate inputs on the server and can be shared with client forms.
  Category-specific listing forms render from category definitions and validate
  category attributes against category-specific schemas.

### Supabase platform

- Supabase Auth for registration and sessions, with server-side session handling
  through `@supabase/ssr`.
- PostgreSQL as the system of record, with RLS enabled for user-owned and
  participant-specific data. Use the Supabase service-role key only in trusted
  server contexts; never expose it to the browser.
- Supabase Storage for listing images and any approved verification files. Use
  private buckets and short-lived signed URLs for sensitive documents.
- Database migrations define schema, indexes, constraints, and RLS policies.

### Core data model (initial)

- `profiles`: public profile fields, verification status, and rating summary.
- `categories`: category identifiers, Arabic/French labels, and supported
  attribute definitions.
- `listings`: owner, category, title, description, price, pricing unit,
  location (wilaya and commune), availability, caution terms, and
  category-specific attributes (JSONB validated against the selected category).
- `listing_images`: storage paths and display order.
- `rental_requests`: listing, renter, requested dates, total-price and
  caution-term snapshots, caution status, and a constrained lifecycle (pending,
  approved, active, completed, cancelled). Confirmed rentals cannot overlap;
  booking dates use an end-exclusive range.
- `reviews`: booking-linked, bilateral reviews with one review per participant
  per booking.
- `identity_checks`: verification provider/reference, status, and timestamps;
  avoid storing identity document contents unless a reviewed compliance need
  requires it.
- `contracts`: booking-linked generated document metadata and immutable terms
  snapshot/version.

Use database constraints and transactions for invariants such as valid booking
dates, non-overlapping confirmed reservations, and one review per party per
booking. Define indexes for category, wilaya, price, and availability search.
The initial schema and RLS policies are defined in
`supabase/migrations/20261014180000_initial_marketplace_schema.sql`. Profile
rows are private by default; public profile presentation should use a
deliberately limited view rather than exposing phone numbers.

### Listing, search, and booking flow

1. A lister chooses a category and completes the corresponding validated
   attribute fields (for example, mileage for a vehicle or accessories and
   serial number for electronics).
2. The server validates common and category-specific fields, stores the listing,
   and associates uploaded images with its owner.
3. Search filters combine category, wilaya/commune, price range and pricing
   period, and requested availability. Recheck availability on the server when
   accepting a booking; client-side search results are not authoritative.
4. A booking records a snapshot of the agreed price and caution terms so later
   listing edits do not silently change an existing agreement.
5. After both parties have accepted the terms, generate a PDF agreement from
   the booking snapshot and parties' permitted profile details. Store the
   artifact privately and allow only the booking participants to access it.
6. Allow bilateral reviews after a booking reaches the completed state.

### Trust, caution, and payments

Represent identity verification as an explicit status, not a claim inferred
from profile data. Show caution amount, handling terms, and refund conditions
before a renter submits a booking. A deposit ledger and payment lifecycle must
be reconciled with a payment provider; Supabase is not a payment processor.
Choose and review a provider, local availability, legal obligations, dispute
handling, and whether funds are held or merely authorized before implementing
real-money custody. Never store card details directly.

Featured Listing and Pro Store checkout currently offer two configurable plans
with DZD and USD/USDT prices. BaridiMob, CCP, and Bybit transfers are submitted
for administrator review before activation. Card checkout is intentionally a
local-demo-only simulation: it accepts no PAN/CVV, performs no real
authorization or 3-D Secure challenge, and never activates a production
subscription. A production card flow requires a hosted PCI-compliant processor
and a verified server-side payment webhook before it can be enabled.

The contract is a convenience document based on mutually confirmed terms, not
a substitute for legal review. Have local counsel review contract wording,
identity handling, payments, consumer protection, and rental rules before
launch.

## Dependencies to install

Install the current compatible stable versions when bootstrapping the Next.js
application; use the official Next.js setup to configure TypeScript, Tailwind,
App Router, and the `src/` directory.

### Runtime dependencies

- `next`, `react`, `react-dom` — application framework and UI runtime.
- `@supabase/supabase-js`, `@supabase/ssr` — Supabase client and Next.js
  server-side auth/session integration.
- `lucide-react` — icons.
- `zod`, `react-hook-form`, `@hookform/resolvers` — input schemas and forms.
- `date-fns` — date display and booking date utilities.
- `clsx`, `tailwind-merge`, `class-variance-authority` — Shadcn/UI class and
  variant utilities (often included by the Shadcn setup).
- `pdf-lib` — server-side PDF generation and form/document composition.

### Development dependencies and setup

- `typescript`, `@types/node`, `@types/react`, `@types/react-dom` — TypeScript
  and type definitions.
- `tailwindcss`, `postcss` — Tailwind CSS processing (versions/configuration
  should follow the selected Next.js starter).
- Shadcn/UI CLI — add only the UI components the application uses.
- Supabase CLI — local development, migrations, and database type generation.
- A test runner such as `vitest` and browser tests with `playwright` when the
  application reaches the testing milestone.

Avoid installing every Shadcn/UI component or adding a payment, mapping, or
localization provider before its product and compliance requirements are
selected.

## Roadmap

### Phase 1 — Foundation

- Initialize Next.js, TypeScript, Tailwind CSS, linting, and Shadcn/UI.
- Configure Supabase local development, environment-variable validation, and
  migration workflow.
- Define visual foundations and Arabic RTL/French-ready layout behavior.

### Phase 2 — Accounts and trust baseline

- Implement Arabic/French sign-up, login, logout, profile editing, and account
  protection. The Supabase-backed login, registration, and account dashboard
  are available at `/login`, `/register`, and `/dashboard`.
- Add private identity-document submission with a pending-review state; only
  an authorized verification process can set the trusted verification flag.
- Establish user-owned and participant-only database/storage policies in
  `supabase/migrations/20261014193000_auth_dashboard_identity.sql`. Supabase
  integration tests and operational verification review remain outstanding.

### Phase 3 — Listings and discovery

- Implement categories and data-driven category forms with server-side
  validation.
- Add listing image upload, listing management, and listing detail pages.
- Add category, rate, location, and availability search and filters.
- The bilingual Add Listing wizard at `/list-an-item` uploads photos to
  Supabase Storage and inserts the listing when configured; without credentials
  it stores compressed listing images and listing data in browser LocalStorage.
- Discovery at `/` uses active Supabase listings and public owner trust details
  when configured, and merges locally created listings into the sample catalog
  in demo mode. Category, wilaya, text, and daily-price filters apply instantly.
- Listing detail routes at `/listings/[id]` now render the interactive gallery,
  category metadata, owner trust summary, caution terms, and a responsive
  date-based request/contact widget. Discovery cards link to these routes.
- With Supabase configured, rental requests are authenticated inserts and
  availability is checked against confirmed/active bookings. Without
  credentials, bundled demo listings support local-only request and availability
  demonstrations; these requests are stored in the shared local marketplace
  store used by the dashboard and local contract flow.
- Apply `supabase/full_setup.sql` in the Supabase SQL Editor for the complete
  schema, seed categories, storage bucket, and access policies. Ordered
  individual migrations remain available under `supabase/migrations`.

### Phase 4 — Booking and caution terms

- Implement booking requests, owner decisions, cancellation, and booking state
  transitions.
- Prevent conflicting confirmed reservations and preserve agreed price and
  caution snapshots.
- Finalize payment-provider and deposit-handling decisions before enabling
  collection or custody of funds.

### Phase 5 — Contracts and reviews

- Generate, privately store, and authorize access to booking-specific PDF
  agreements.
- Implement bilateral reviews limited to completed bookings.
- Add reporting and dispute workflows appropriate to the launch policy.
- An Arabic/French PDF agreement generator and sample preview are available at
  `/agreement-demo`. Printing/export is gated on an approved, active, or
  completed booking; integrate it with authenticated booking data and signed
  artifact storage before production use.
- Agreement export uses an Arabic Cairo HTML template with an A4 print stylesheet
  and the browser's Save as PDF workflow to preserve Arabic shaping and bidi text.
- Agreement pickup/return timestamps, item condition, and handover terms are
  added by `supabase/migrations/20261014190000_add_rental_agreement_fields.sql`.

### Phase 6 — Hardening and launch

- Add unit, integration, and end-to-end coverage for permissions, search,
  booking conflicts, and contract access.
- Review accessibility, mobile performance, RTL behavior, database indexes,
  storage policies, and operational logging.
- Complete legal, privacy, identity-verification, and payment-provider reviews;
  deploy with backups and production monitoring.

## Initial acceptance criteria

- A user can create and manage a listing whose required fields adapt to its
  category.
- A renter can filter listings by category, rate, location, and availability.
- A booking clearly presents both parties' identity status and the caution
  terms before confirmation.
- Only the booking participants can access its generated agreement.
- Only participants in a completed booking can submit their respective
  reviews.
- RLS and server-side authorization prevent users from changing or reading
  another user's private data.
- Arabic RTL login and registration at `/login` and `/register` support email
  with passwords and phone-number SMS one-time codes. Email confirmations return
  through `/auth/callback`.
- `/dashboard` provides listing management, incoming/outgoing rental requests,
  profile editing, and private national-ID uploads. Identity documents use a
  private Supabase Storage bucket; uploads remain pending review and users
  cannot self-assert a verified badge.
- Without Supabase credentials, `/dashboard` offers browser-local listing
  management, profile editing, request approval/rejection, and printable
  contracts for approved demo requests. Local demo photos are resized before
  persistence to limit browser storage use; clearing site data removes them.
- Confirmed rental requests have participant-only printable contracts at
  `/dashboard/contracts/[id]`, backed by a permission-checked database RPC.
- `/admin` is the Arabic RTL administration center for overview metrics, private
  identity-document review, listing moderation, account roles and suspensions,
  rental-contract review, and category fields. Admin page access and mutations
  require a non-suspended authenticated profile with `role = 'admin'`; matching
  RLS policies protect the underlying data and private identity-file bucket.
- Without Supabase credentials, `/admin` runs in browser-local demo mode with
  seeded sample users, identity submissions, rentals, and categories. Changes
  stay in the current browser and are not a substitute for server authorization.
- Listing details display booked and owner-blocked dates; owners can manage
  blackout dates and request a featured-listing promotion with a BaridiMob/CCP
  receipt. Promotion settings in `/admin` control official payment details and
  enabled plan names, prices, and durations. Owners submit a plan, payment
  method, unique transaction reference, sender information, and receipt image;
  administrators review these details before approval.
- Approved promotions set `featured_until`; expired listings lose their badge
  and ranking priority and notify their owner. Supabase projects use hourly
  `pg_cron` processing when that extension is enabled, while marketplace,
  listing, dashboard, and admin requests also run an idempotent expiration
  check. Local demo promotions, settings, uniqueness checks, and expiration
  notifications are stored in browser LocalStorage.
- Rental participants can add check-in/check-out notes and photos, submit
  bilateral reviews after completion, and see rating updates. Contract print
  views include a QR link to `/verify/[id]`; live verification exposes only
  contract status, listing title, and rental dates.
- The marketplace and dashboard headers display unread in-app notifications.
  The availability, handover, review, promotion, notification, and contract
  verification schema is defined in
  `supabase/migrations/20261015110000_trust_marketplace_features.sql` and
  `supabase/migrations/20261015120000_promotion_payment_plans.sql`; both are
  included in `supabase/full_setup.sql`.
- Listings may set discounted weekly/monthly rates, one-time delivery pricing,
  and per-day add-ons. Booking totals are recomputed and validated by the
  database, and the selected delivery/add-on terms are snapshotted into rental
  requests and printable contracts.
- Rental participants can submit damage, late-return, no-show, fraud, or other
  reports. Administrators can review reports, open contracts, inspect signed
  handover photos, and suspend an offending account. Pro Store applications
  include payment proof and are approved by an administrator; approved stores
  have public `/stores` and `/stores/[slug]` pages with expiring access.
- Favorites are stored in Supabase for signed-in users and mirrored to
  browser-local storage for guests and local demo mode. Listing details provide
  native sharing, WhatsApp sharing, and copyable share text.
- These marketplace enhancements are defined in
  `supabase/migrations/20261015130000_professional_marketplace_features.sql`
  and are mirrored in `supabase/full_setup.sql`.
- To bootstrap the first production administrator, register the owner's account
  and run the documented profile-role update at the end of
  `supabase/migrations/20261015100000_admin_dashboard.sql` (or use
  `supabase/full_setup.sql` for a fresh project). Never expose a service-role
  key to the browser.
- These account features require Supabase credentials in `.env.local` and the
  migrations under `supabase/migrations` to be applied. Review identity-document
  handling for privacy and legal compliance before launch.
- Listing photos use the public `listing-images` bucket with authenticated
  uploads restricted to each owner's user-ID folder. Contract and listing
  persistence in demo mode is local to the browser and is not shared with other
  users or devices.
