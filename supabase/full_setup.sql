-- ============================================================================
-- 20261014180000_initial_marketplace_schema.sql
-- ============================================================================
-- Ekrrili marketplace schema for Supabase.

create extension if not exists btree_gist with schema extensions;

create type public.caution_type as enum ('cash', 'cheque');
create type public.caution_status as enum ('not_required', 'pending', 'held', 'refunded', 'forfeited');
create type public.listing_status as enum ('active', 'paused', 'rented');
create type public.rental_request_status as enum ('pending', 'approved', 'active', 'completed', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone_number text,
  identity_verified boolean not null default false,
  rating numeric(3, 2) not null default 0,
  avatar_url text,
  wilaya text,
  created_at timestamptz not null default now(),
  constraint profiles_rating_range check (rating between 0 and 5)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name_ar text not null,
  name_fr text not null,
  slug text not null unique,
  icon text,
  dynamic_schema jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint categories_dynamic_schema_object check (jsonb_typeof(dynamic_schema) = 'object')
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete restrict,
  title text not null,
  description text not null default '',
  price_per_day numeric(12, 2) not null,
  caution_deposit_amount numeric(12, 2) not null default 0,
  caution_type public.caution_type,
  wilaya text not null,
  commune text not null,
  images text[] not null default array[]::text[],
  metadata jsonb not null default '{}'::jsonb,
  status public.listing_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listings_title_not_blank check (length(trim(title)) > 0),
  constraint listings_price_nonnegative check (price_per_day >= 0),
  constraint listings_caution_nonnegative check (caution_deposit_amount >= 0),
  constraint listings_caution_type_required check (
    (caution_deposit_amount = 0 and caution_type is null)
    or (caution_deposit_amount > 0 and caution_type is not null)
  ),
  constraint listings_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint listings_images_no_nulls check (array_position(images, null) is null)
);

create table public.rental_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  renter_id uuid not null references public.profiles (id) on delete cascade,
  start_date date not null,
  end_date date not null,
  total_price numeric(12, 2) not null,
  caution_deposit_amount numeric(12, 2) not null default 0,
  caution_type public.caution_type,
  caution_status public.caution_status not null default 'pending',
  status public.rental_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rental_requests_valid_dates check (start_date < end_date),
  constraint rental_requests_total_nonnegative check (total_price >= 0),
  constraint rental_requests_caution_nonnegative check (caution_deposit_amount >= 0),
  constraint rental_requests_caution_type_required check (
    (caution_deposit_amount = 0 and caution_type is null)
    or (caution_deposit_amount > 0 and caution_type is not null)
  )
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  rental_request_id uuid not null references public.rental_requests (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  reviewee_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null,
  comment text not null default '',
  created_at timestamptz not null default now(),
  constraint reviews_rating_range check (rating between 1 and 5),
  constraint reviews_distinct_participants check (reviewer_id <> reviewee_id),
  constraint reviews_one_per_reviewer unique (rental_request_id, reviewer_id)
);

-- Public profile fields only; private contact details remain behind profile RLS.
create view public.public_profiles
with (security_barrier = true)
as
select id, full_name, identity_verified, rating, avatar_url, wilaya, created_at
from public.profiles;

create index listings_category_status_idx on public.listings (category_id, status);
create index listings_owner_created_idx on public.listings (owner_id, created_at desc);
create index listings_wilaya_commune_idx on public.listings (wilaya, commune);
create index listings_price_per_day_idx on public.listings (price_per_day);
create index rental_requests_listing_dates_idx on public.rental_requests (listing_id, start_date, end_date);
create index rental_requests_renter_created_idx on public.rental_requests (renter_id, created_at desc);
create index rental_requests_status_idx on public.rental_requests (status);
create index reviews_reviewee_created_idx on public.reviews (reviewee_id, created_at desc);

-- A listing cannot be confirmed for overlapping date ranges.
alter table public.rental_requests
  add constraint rental_requests_no_overlapping_confirmed_dates
  exclude using gist (
    listing_id with =,
    daterange(start_date, end_date, '[)') with &&
  )
  where (status in ('approved', 'active'));

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger listings_set_updated_at
before update on public.listings
for each row execute function public.set_updated_at();

create trigger rental_requests_set_updated_at
before update on public.rental_requests
for each row execute function public.set_updated_at();

-- Snapshot the listing terms and ensure a request is valid when it is created.
create function public.prepare_rental_request()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  listing_record record;
begin
  select l.owner_id, l.status, l.price_per_day,
         l.caution_deposit_amount, l.caution_type
  into listing_record
  from public.listings as l
  where l.id = new.listing_id;

  if not found then
    raise exception 'Listing does not exist';
  end if;
  if listing_record.owner_id = new.renter_id then
    raise exception 'Listing owners cannot rent their own listing';
  end if;
  if listing_record.status <> 'active' then
    raise exception 'Only active listings can be requested';
  end if;
  if new.status <> 'pending' then
    raise exception 'New rental requests must start as pending';
  end if;
  if new.total_price <> listing_record.price_per_day * (new.end_date - new.start_date) then
    raise exception 'Total price does not match the listing daily rate and rental dates';
  end if;

  new.caution_deposit_amount := listing_record.caution_deposit_amount;
  new.caution_type := listing_record.caution_type;
  new.caution_status := case
    when listing_record.caution_deposit_amount = 0 then 'not_required'::public.caution_status
    else 'pending'::public.caution_status
  end;
  return new;
end;
$$;

create trigger rental_requests_prepare_insert
before insert on public.rental_requests
for each row execute function public.prepare_rental_request();

-- Create a private profile for each new Supabase Auth user.
create function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function public.create_profile_for_auth_user();

-- Do not let a normal user self-assert verification or manipulate their rating.
create function public.guard_profile_trust_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and (new.identity_verified is distinct from old.identity_verified
          or new.rating is distinct from old.rating) then
    raise exception 'Identity verification and rating are system-managed fields';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_trust_fields
before update on public.profiles
for each row execute function public.guard_profile_trust_fields();

-- Keep the booking's agreed terms immutable and limit status transitions.
create function public.guard_rental_request_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  listing_owner_id uuid;
  current_user_id uuid := auth.uid();
begin
  if new.listing_id is distinct from old.listing_id
     or new.renter_id is distinct from old.renter_id
     or new.start_date is distinct from old.start_date
     or new.end_date is distinct from old.end_date
     or new.total_price is distinct from old.total_price
     or new.caution_deposit_amount is distinct from old.caution_deposit_amount
     or new.caution_type is distinct from old.caution_type then
    raise exception 'Rental request terms cannot be changed after submission';
  end if;

  if current_user_id is null or new.status = old.status then
    if new.caution_status is distinct from old.caution_status then
      select l.owner_id into listing_owner_id
      from public.listings as l
      where l.id = old.listing_id;

      if current_user_id <> listing_owner_id
         or not (
           (old.caution_status = 'pending' and new.caution_status in ('held', 'refunded', 'forfeited'))
           or (old.caution_status = 'held' and new.caution_status in ('refunded', 'forfeited'))
         ) then
        raise exception 'Invalid caution status transition';
      end if;
    end if;
    return new;
  end if;

  select l.owner_id into listing_owner_id
  from public.listings as l
  where l.id = old.listing_id;

  if current_user_id = old.renter_id
     and old.status in ('pending', 'approved')
     and new.status = 'cancelled'
     and new.caution_status = old.caution_status then
    return new;
  end if;

  if current_user_id = listing_owner_id
     and ((old.status = 'pending' and new.status in ('approved', 'cancelled'))
       or (old.status = 'approved' and new.status in ('active', 'cancelled'))
       or (old.status = 'active' and new.status = 'completed'))
     and (
       new.caution_status = old.caution_status
       or (old.caution_status = 'pending' and new.caution_status in ('held', 'refunded', 'forfeited'))
       or (old.caution_status = 'held' and new.caution_status in ('refunded', 'forfeited'))
     ) then
    return new;
  end if;

  raise exception 'Invalid rental request status transition';
end;
$$;

create trigger rental_requests_guard_update
before update on public.rental_requests
for each row execute function public.guard_rental_request_update();

-- Security-definer lookup avoids listing/request RLS blocking the counterpart check.
create function public.can_review_completed_rental(
  request_id uuid,
  reviewee_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.rental_requests as rr
    join public.listings as l on l.id = rr.listing_id
    where rr.id = $1
      and rr.status = 'completed'
      and (
        (rr.renter_id = (select auth.uid()) and l.owner_id = $2)
        or (l.owner_id = (select auth.uid()) and rr.renter_id = $2)
      )
  );
$$;

revoke all on function public.can_review_completed_rental(uuid, uuid) from public;
grant execute on function public.can_review_completed_rental(uuid, uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.listings enable row level security;
alter table public.rental_requests enable row level security;
alter table public.reviews enable row level security;

grant select on public.categories to anon, authenticated;
grant select on public.listings to anon, authenticated;
grant select on public.public_profiles to anon, authenticated;
grant insert, update, delete on public.listings to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.rental_requests to authenticated;
grant select, insert on public.reviews to authenticated;

create policy "Categories are publicly readable"
on public.categories for select
to anon, authenticated
using (true);

create policy "Active listings are public; owners can see all their listings"
on public.listings for select
to anon, authenticated
using (status = 'active' or owner_id = (select auth.uid()));

create policy "Users create listings for themselves"
on public.listings for insert
to authenticated
with check (owner_id = (select auth.uid()));

create policy "Owners update their own listings"
on public.listings for update
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "Owners delete their own listings"
on public.listings for delete
to authenticated
using (owner_id = (select auth.uid()));

create policy "Users read their own profile"
on public.profiles for select
to authenticated
using (id = (select auth.uid()));

create policy "Users create their own profile"
on public.profiles for insert
to authenticated
with check (
  id = (select auth.uid())
  and identity_verified = false
  and rating = 0
);

create policy "Users update their own profile"
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "Participants read rental requests"
on public.rental_requests for select
to authenticated
using (
  renter_id = (select auth.uid())
  or exists (
    select 1 from public.listings l
    where l.id = listing_id and l.owner_id = (select auth.uid())
  )
);

create policy "Users request active listings as renters"
on public.rental_requests for insert
to authenticated
with check (
  renter_id = (select auth.uid())
  and status = 'pending'
  and exists (
    select 1 from public.listings l
    where l.id = listing_id
      and l.status = 'active'
      and l.owner_id <> (select auth.uid())
  )
);

create policy "Listing owners update rental request status"
on public.rental_requests for update
to authenticated
using (
  exists (
    select 1 from public.listings l
    where l.id = listing_id and l.owner_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.listings l
    where l.id = listing_id and l.owner_id = (select auth.uid())
  )
);

create policy "Renters cancel their own pending or approved requests"
on public.rental_requests for update
to authenticated
using (
  renter_id = (select auth.uid())
  and status in ('pending', 'approved')
)
with check (
  renter_id = (select auth.uid())
  and status = 'cancelled'
);

create policy "Participants read reviews"
on public.reviews for select
to authenticated
using (
  reviewer_id = (select auth.uid())
  or reviewee_id = (select auth.uid())
);

create policy "Participants review completed rentals"
on public.reviews for insert
to authenticated
with check (
  reviewer_id = (select auth.uid())
  and public.can_review_completed_rental(rental_request_id, reviewee_id)
);


-- ============================================================================
-- 20261014190000_add_rental_agreement_fields.sql
-- ============================================================================
alter table public.listings
  add column item_condition text not null default 'Not provided';

alter table public.rental_requests
  add column pickup_at timestamptz,
  add column return_at timestamptz,
  add column damage_terms text not null default
    'The renter is responsible for damage beyond normal wear and tear and should notify the owner promptly.',
  add column late_return_terms text not null default
    'The renter must return the item at the agreed time. Any extension or additional charge requires agreement between both parties.',
  add column caution_reimbursement_terms text not null default
    'The caution is returned after handover and inspection, less any documented amounts agreed by both parties.';

update public.rental_requests
set pickup_at = start_date::timestamp at time zone 'UTC',
    return_at = end_date::timestamp at time zone 'UTC'
where pickup_at is null or return_at is null;

alter table public.rental_requests
  alter column pickup_at set not null,
  alter column return_at set not null,
  add constraint rental_requests_valid_pickup_return check (pickup_at < return_at);


-- ============================================================================
-- 20261014193000_auth_dashboard_identity.sql
-- ============================================================================
-- Participants can still read the listing attached to their own rental request,
-- even if the owner pauses it after the request was submitted.
create function public.is_renter_for_listing(listing_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.rental_requests rr
    where rr.listing_id = $1
      and rr.renter_id = (select auth.uid())
  );
$$;

revoke all on function public.is_renter_for_listing(uuid) from public;
grant execute on function public.is_renter_for_listing(uuid) to authenticated;

create policy "Renters can read requested listings"
on public.listings for select
to authenticated
using (public.is_renter_for_listing(listings.id));

create function public.prevent_listing_delete_with_requests()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.rental_requests rr where rr.listing_id = old.id
  ) then
    raise exception 'Listings with rental history cannot be deleted';
  end if;
  return old;
end;
$$;

create trigger listings_prevent_delete_with_requests
before delete on public.listings
for each row execute function public.prevent_listing_delete_with_requests();

create table public.identity_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  storage_path text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint identity_documents_path_belongs_to_user
    check (storage_path like user_id::text || '/%')
);

alter table public.identity_documents enable row level security;
grant select, insert on public.identity_documents to authenticated;

create policy "Users read their own identity submissions"
on public.identity_documents for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Users submit identity documents for themselves"
on public.identity_documents for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'pending'
  and reviewed_at is null
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ekrrili-identity-documents',
  'ekrrili-identity-documents',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'application/pdf']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Users upload their own identity documents"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'ekrrili-identity-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users read their own identity documents"
on storage.objects for select
to authenticated
using (
  bucket_id = 'ekrrili-identity-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users remove their own identity documents"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'ekrrili-identity-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- Exposes only the contract fields to a confirmed booking participant.
create function public.get_rental_agreement(request_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'contractId', 'EKR-' || upper(substr(rr.id::text, 1, 12)),
    'generatedAt', now(),
    'status', rr.status,
    'owner', jsonb_build_object(
      'fullName', owner_profile.full_name,
      'phoneNumber', coalesce(owner_profile.phone_number, 'غير مسجل')
    ),
    'renter', jsonb_build_object(
      'fullName', renter_profile.full_name,
      'phoneNumber', coalesce(renter_profile.phone_number, 'غير مسجل')
    ),
    'item', jsonb_build_object(
      'title', l.title,
      'condition', l.item_condition,
      'accessories', case
        when jsonb_typeof(l.metadata -> 'accessories') = 'array'
          then l.metadata -> 'accessories'
        else '[]'::jsonb
      end
    ),
    'caution', jsonb_build_object(
      'amountDzd', rr.caution_deposit_amount,
      'type', rr.caution_type,
      'reimbursementTerms', rr.caution_reimbursement_terms
    ),
    'rental', jsonb_build_object(
      'pickupAt', rr.pickup_at,
      'returnAt', rr.return_at,
      'totalCostDzd', rr.total_price,
      'damageTerms', rr.damage_terms,
      'lateReturnTerms', rr.late_return_terms
    )
  )
  into result
  from public.rental_requests rr
  join public.listings l on l.id = rr.listing_id
  join public.profiles owner_profile on owner_profile.id = l.owner_id
  join public.profiles renter_profile on renter_profile.id = rr.renter_id
  where rr.id = request_id
    and rr.status in ('approved', 'active', 'completed')
    and (rr.renter_id = (select auth.uid()) or l.owner_id = (select auth.uid()));

  if result is null then
    raise exception 'Confirmed rental agreement not found or access denied';
  end if;

  return result;
end;
$$;

revoke all on function public.get_rental_agreement(uuid) from public;
grant execute on function public.get_rental_agreement(uuid) to authenticated;


-- ============================================================================
-- 20261014200000_listing_details_booking.sql
-- ============================================================================
create function public.is_listing_available(
  requested_listing_id uuid,
  requested_start date,
  requested_end date
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select requested_start < requested_end
    and exists (
      select 1
      from public.listings l
      where l.id = requested_listing_id
        and l.status = 'active'
        and not exists (
          select 1
          from public.rental_requests rr
          where rr.listing_id = l.id
            and rr.status in ('approved', 'active')
            and daterange(rr.start_date, rr.end_date, '[)')
                && daterange(requested_start, requested_end, '[)')
        )
    );
$$;

revoke all on function public.is_listing_available(uuid, date, date) from public;
grant execute on function public.is_listing_available(uuid, date, date) to anon, authenticated;

create or replace function public.prepare_rental_request()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  listing_record record;
begin
  select l.owner_id, l.status, l.price_per_day,
         l.caution_deposit_amount, l.caution_type
  into listing_record
  from public.listings as l
  where l.id = new.listing_id
  for key share;

  if not found then
    raise exception 'Listing does not exist';
  end if;
  if listing_record.owner_id = new.renter_id then
    raise exception 'Listing owners cannot rent their own listing';
  end if;
  if listing_record.status <> 'active' then
    raise exception 'Only active listings can be requested';
  end if;
  if new.status <> 'pending' then
    raise exception 'New rental requests must start as pending';
  end if;
  if new.total_price <> listing_record.price_per_day * (new.end_date - new.start_date) then
    raise exception 'Total price does not match the listing daily rate and rental dates';
  end if;
  if exists (
    select 1
    from public.rental_requests rr
    where rr.listing_id = new.listing_id
      and rr.status in ('approved', 'active')
      and daterange(rr.start_date, rr.end_date, '[)')
          && daterange(new.start_date, new.end_date, '[)')
  ) then
    raise exception 'Rental dates are unavailable';
  end if;

  new.caution_deposit_amount := listing_record.caution_deposit_amount;
  new.caution_type := listing_record.caution_type;
  new.caution_status := case
    when listing_record.caution_deposit_amount = 0 then 'not_required'::public.caution_status
    else 'pending'::public.caution_status
  end;
  return new;
end;
$$;

create function public.get_listing_contact(requested_listing_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  contact_number text;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in to contact the listing owner';
  end if;

  select p.phone_number into contact_number
  from public.listings l
  join public.profiles p on p.id = l.owner_id
  where l.id = requested_listing_id
    and (l.status = 'active' or l.owner_id = (select auth.uid()));

  if contact_number is null then
    raise exception 'The owner has not provided a contact number';
  end if;

  return contact_number;
end;
$$;

revoke all on function public.get_listing_contact(uuid) from public;
grant execute on function public.get_listing_contact(uuid) to authenticated;


-- ============================================================================
-- 20261014210000_hybrid_listing_storage.sql
-- ============================================================================
insert into public.categories (name_ar, name_fr, slug, icon, dynamic_schema)
values
  ('كاميرات وتصوير', 'Photo & caméra', 'camera', 'camera', '{"fields":[{"name":"model","type":"text","label":"الطراز"},{"name":"serialNumber","type":"text","label":"الرقم التسلسلي"},{"name":"accessories","type":"checkboxes","label":"الملحقات المتضمنة"}]}'::jsonb),
  ('سيارات ومركبات', 'Véhicules', 'vehicle', 'car-front', '{"fields":[{"name":"transmission","type":"select","label":"ناقل الحركة"},{"name":"fuelType","type":"select","label":"نوع الوقود"},{"name":"mileage","type":"number","label":"المسافة المقطوعة (كم)"}]}'::jsonb),
  ('معدات وآلات ثقيلة', 'Engins & matériel', 'machinery', 'construction', '{"fields":[{"name":"machineType","type":"text","label":"نوع الآلة"},{"name":"operatingHours","type":"number","label":"ساعات التشغيل"},{"name":"powerSource","type":"select","label":"مصدر الطاقة"}]}'::jsonb),
  ('إلكترونيات', 'Électronique', 'electronics', 'laptop', '{"fields":[{"name":"model","type":"text","label":"الطراز"},{"name":"serialNumber","type":"text","label":"الرقم التسلسلي"},{"name":"accessories","type":"checkboxes","label":"الملحقات المتضمنة"}]}'::jsonb),
  ('لوازم المناسبات', 'Événementiel', 'event', 'party-popper', '{"fields":[{"name":"itemType","type":"text","label":"نوع المستلزم"},{"name":"quantity","type":"number","label":"الكمية المتاحة"}]}'::jsonb),
  ('تخييم ورحلات', 'Camping & plein air', 'camping', 'tent-tree', '{"fields":[{"name":"itemType","type":"text","label":"نوع المعدات"},{"name":"capacity","type":"number","label":"السعة (عدد الأشخاص)"}]}'::jsonb),
  ('عقارات', 'Immobilier', 'real-estate', 'house', '{"fields":[{"name":"propertyType","type":"text","label":"نوع العقار"},{"name":"bedrooms","type":"number","label":"عدد الغرف"},{"name":"area","type":"number","label":"المساحة (م²)"}]}'::jsonb)
on conflict (slug) do update set
  name_ar = excluded.name_ar,
  name_fr = excluded.name_fr,
  icon = excluded.icon,
  dynamic_schema = excluded.dynamic_schema;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-images', 'listing-images', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Listing images are publicly readable" on storage.objects;
create policy "Listing images are publicly readable"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'listing-images');

drop policy if exists "Owners upload listing images to their own folder" on storage.objects;
create policy "Owners upload listing images to their own folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'listing-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Owners update listing images in their own folder" on storage.objects;
create policy "Owners update listing images in their own folder"
on storage.objects for update
to authenticated
using (
  bucket_id = 'listing-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'listing-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Owners delete listing images in their own folder" on storage.objects;
create policy "Owners delete listing images in their own folder"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'listing-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1
       from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'listings'
     ) then
    alter publication supabase_realtime add table public.listings;
  end if;
end;
$$;


-- ============================================================================
-- 20261015100000_admin_dashboard.sql
-- ============================================================================
alter table public.profiles
  add column role text not null default 'user'
    check (role in ('user', 'admin')),
  add column is_suspended boolean not null default false;

alter table public.listings
  add column is_featured boolean not null default false;

alter table public.identity_documents
  add column rejection_note text;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and not p.is_suspended
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.guard_profile_trust_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and not public.is_admin()
     and (new.identity_verified is distinct from old.identity_verified
          or new.rating is distinct from old.rating) then
    raise exception 'Identity verification and rating are system-managed fields';
  end if;
  return new;
end;
$$;

create or replace function public.guard_profile_admin_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and not public.is_admin()
     and (new.role is distinct from old.role
          or new.is_suspended is distinct from old.is_suspended) then
    raise exception 'Role and suspension changes require an administrator';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_admin_fields
before update on public.profiles
for each row execute function public.guard_profile_admin_fields();

drop policy "Users create their own profile" on public.profiles;
create policy "Users create ordinary profiles"
on public.profiles for insert
to authenticated
with check (
  id = (select auth.uid())
  and identity_verified = false
  and rating = 0
  and role = 'user'
  and is_suspended = false
);

drop policy "Users read their own profile" on public.profiles;
create policy "Users and admins read profiles"
on public.profiles for select
to authenticated
using (id = (select auth.uid()) or public.is_admin());

drop policy "Users update their own profile" on public.profiles;
create policy "Users update own profile; admins manage all profiles"
on public.profiles for update
to authenticated
using (id = (select auth.uid()) or public.is_admin())
with check (id = (select auth.uid()) or public.is_admin());

create policy "Admins read all listings"
on public.listings for select
to authenticated
using (public.is_admin());

create policy "Admins manage listings"
on public.listings for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins delete listings"
on public.listings for delete
to authenticated
using (public.is_admin());

grant update, delete on public.listings to authenticated;

create policy "Admins read all rental requests"
on public.rental_requests for select
to authenticated
using (public.is_admin());

create policy "Admins read all identity documents"
on public.identity_documents for select
to authenticated
using (public.is_admin());

create policy "Admins review identity documents"
on public.identity_documents for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

grant update on public.identity_documents to authenticated;

create or replace function public.admin_review_identity_document(
  document_id uuid,
  decision text,
  note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;
  if decision not in ('approved', 'rejected') then
    raise exception 'Invalid identity review decision';
  end if;

  update public.identity_documents
  set status = decision,
      rejection_note = case when decision = 'rejected' then nullif(trim(note), '') else null end,
      reviewed_at = now()
  where id = document_id
    and status = 'pending'
  returning user_id into target_user_id;

  if target_user_id is null then
    raise exception 'Pending identity submission not found';
  end if;

  update public.profiles
  set identity_verified = (decision = 'approved')
  where id = target_user_id;
end;
$$;

revoke all on function public.admin_review_identity_document(uuid, text, text) from public;
grant execute on function public.admin_review_identity_document(uuid, text, text) to authenticated;

create policy "Admins read private identity files"
on storage.objects for select
to authenticated
using (
  bucket_id = 'ekrrili-identity-documents'
  and public.is_admin()
);

create policy "Admins manage categories"
on public.categories for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins delete categories"
on public.categories for delete
to authenticated
using (public.is_admin());

grant update, delete on public.categories to authenticated;

-- Bootstrap the first administrator manually after registering:
-- update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'owner@example.com');

-- Trust, availability, and marketplace features.
create table public.listing_blackout_dates (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  blocked_date date not null,
  created_at timestamptz not null default now(),
  unique (listing_id, blocked_date)
);

alter table public.listing_blackout_dates enable row level security;
grant select on public.listing_blackout_dates to anon, authenticated;
grant insert, delete on public.listing_blackout_dates to authenticated;

create policy "Blackout dates are publicly readable"
on public.listing_blackout_dates for select
to anon, authenticated
using (true);

create policy "Owners create their own blackout dates"
on public.listing_blackout_dates for insert
to authenticated
with check (
  owner_id = (select auth.uid())
  and exists (
    select 1 from public.listings l
    where l.id = listing_id and l.owner_id = (select auth.uid())
  )
);

create policy "Owners remove their own blackout dates"
on public.listing_blackout_dates for delete
to authenticated
using (owner_id = (select auth.uid()));

create or replace function public.get_listing_unavailable_dates(
  requested_listing_id uuid,
  requested_start date,
  requested_end date
)
returns table (unavailable_date date, reason text)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct dates.unavailable_date, dates.reason
  from (
    select generated.day::date as unavailable_date, 'booked'::text as reason
    from public.rental_requests rr
    cross join lateral generate_series(
      greatest(rr.start_date, requested_start)::timestamp,
      least(rr.end_date - 1, requested_end - 1)::timestamp,
      interval '1 day'
    ) generated(day)
    where rr.listing_id = requested_listing_id
      and rr.status in ('approved', 'active')
      and daterange(rr.start_date, rr.end_date, '[)')
          && daterange(requested_start, requested_end, '[)')
    union all
    select blocked.blocked_date, 'blocked'::text
    from public.listing_blackout_dates blocked
    where blocked.listing_id = requested_listing_id
      and blocked.blocked_date >= requested_start
      and blocked.blocked_date < requested_end
  ) dates
  order by dates.unavailable_date;
$$;

revoke all on function public.get_listing_unavailable_dates(uuid, date, date) from public;
grant execute on function public.get_listing_unavailable_dates(uuid, date, date) to anon, authenticated;

create or replace function public.is_listing_available(
  requested_listing_id uuid,
  requested_start date,
  requested_end date
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select requested_start < requested_end
    and exists (
      select 1
      from public.listings l
      where l.id = requested_listing_id
        and l.status = 'active'
        and not exists (
          select 1
          from public.rental_requests rr
          where rr.listing_id = l.id
            and rr.status in ('approved', 'active')
            and daterange(rr.start_date, rr.end_date, '[)')
                && daterange(requested_start, requested_end, '[)')
        )
        and not exists (
          select 1
          from public.listing_blackout_dates blocked
          where blocked.listing_id = l.id
            and blocked.blocked_date >= requested_start
            and blocked.blocked_date < requested_end
        )
    );
$$;

revoke all on function public.is_listing_available(uuid, date, date) from public;
grant execute on function public.is_listing_available(uuid, date, date) to anon, authenticated;

create or replace function public.prepare_rental_request()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  listing_record record;
begin
  select l.owner_id, l.status, l.price_per_day,
         l.caution_deposit_amount, l.caution_type
  into listing_record
  from public.listings as l
  where l.id = new.listing_id
  for key share;

  if not found then
    raise exception 'Listing does not exist';
  end if;
  if listing_record.owner_id = new.renter_id then
    raise exception 'Listing owners cannot rent their own listing';
  end if;
  if listing_record.status <> 'active' then
    raise exception 'Only active listings can be requested';
  end if;
  if new.status <> 'pending' then
    raise exception 'New rental requests must start as pending';
  end if;
  if new.total_price <> listing_record.price_per_day * (new.end_date - new.start_date) then
    raise exception 'Total price does not match the listing daily rate and rental dates';
  end if;
  if exists (
    select 1
    from public.rental_requests rr
    where rr.listing_id = new.listing_id
      and rr.status in ('approved', 'active')
      and daterange(rr.start_date, rr.end_date, '[)')
          && daterange(new.start_date, new.end_date, '[)')
  ) or exists (
    select 1
    from public.listing_blackout_dates blocked
    where blocked.listing_id = new.listing_id
      and blocked.blocked_date >= new.start_date
      and blocked.blocked_date < new.end_date
  ) then
    raise exception 'Rental dates are unavailable';
  end if;

  new.caution_deposit_amount := listing_record.caution_deposit_amount;
  new.caution_type := listing_record.caution_type;
  new.caution_status := case
    when listing_record.caution_deposit_amount = 0 then 'not_required'::public.caution_status
    else 'pending'::public.caution_status
  end;
  return new;
end;
$$;

create table public.rental_handover_logs (
  id uuid primary key default gen_random_uuid(),
  rental_request_id uuid not null references public.rental_requests (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  phase text not null check (phase in ('check_in', 'check_out')),
  condition_notes text not null check (length(trim(condition_notes)) between 3 and 2000),
  photo_paths text[] not null default array[]::text[],
  created_at timestamptz not null default now(),
  unique (rental_request_id, user_id, phase)
);

alter table public.rental_handover_logs enable row level security;
grant select, insert on public.rental_handover_logs to authenticated;

create policy "Rental participants read handover logs"
on public.rental_handover_logs for select
to authenticated
using (
  exists (
    select 1
    from public.rental_requests rr
    join public.listings l on l.id = rr.listing_id
    where rr.id = rental_request_id
      and (rr.renter_id = (select auth.uid()) or l.owner_id = (select auth.uid()))
  )
);

create policy "Participants write their own handover logs"
on public.rental_handover_logs for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.rental_requests rr
    join public.listings l on l.id = rr.listing_id
    where rr.id = rental_request_id
      and (rr.renter_id = (select auth.uid()) or l.owner_id = (select auth.uid()))
      and (
        (phase = 'check_in' and rr.status in ('approved', 'active'))
        or (phase = 'check_out' and rr.status in ('active', 'completed'))
      )
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rental-handover-photos', 'rental-handover-photos', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Participants upload handover photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'rental-handover-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Participants read handover photos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'rental-handover-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Rental participants read each other's handover photos"
on storage.objects for select
to authenticated
using (
  bucket_id = 'rental-handover-photos'
  and exists (
    select 1
    from public.rental_handover_logs logs
    join public.rental_requests rr on rr.id = logs.rental_request_id
    join public.listings l on l.id = rr.listing_id
    where name = any(logs.photo_paths)
      and (rr.renter_id = (select auth.uid()) or l.owner_id = (select auth.uid()))
  )
);

alter table public.reviews
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.refresh_profile_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles p
  set rating = coalesce((
    select round(avg(r.rating)::numeric, 2)
    from public.reviews r
    where r.reviewee_id = new.reviewee_id
  ), 0)
  where p.id = new.reviewee_id;
  return new;
end;
$$;

create or replace function public.guard_profile_trust_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and not public.is_admin()
     and (
       new.identity_verified is distinct from old.identity_verified
       or (new.rating is distinct from old.rating and pg_trigger_depth() <= 1)
     ) then
    raise exception 'Identity verification and rating are system-managed fields';
  end if;
  return new;
end;
$$;

create trigger reviews_refresh_profile_rating
after insert on public.reviews
for each row execute function public.refresh_profile_rating();

create table public.listing_promotions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  receipt_path text not null unique,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  rejection_note text
);

create index listing_promotions_status_submitted_idx on public.listing_promotions (status, submitted_at desc);
alter table public.listing_promotions enable row level security;
grant select, insert on public.listing_promotions to authenticated;
grant update on public.listing_promotions to authenticated;

create policy "Owners and admins read promotion requests"
on public.listing_promotions for select
to authenticated
using (owner_id = (select auth.uid()) or public.is_admin());

create policy "Owners submit promotion requests for own listings"
on public.listing_promotions for insert
to authenticated
with check (
  owner_id = (select auth.uid())
  and status = 'pending'
  and exists (
    select 1 from public.listings l
    where l.id = listing_id and l.owner_id = (select auth.uid())
  )
  and receipt_path like owner_id::text || '/%'
);

create policy "Admins review promotion requests"
on public.listing_promotions for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-promotion-receipts', 'listing-promotion-receipts', false, 8388608, array['image/jpeg', 'image/png', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Owners upload their promotion receipts"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'listing-promotion-receipts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Owners and admins read promotion receipts"
on storage.objects for select
to authenticated
using (
  bucket_id = 'listing-promotion-receipts'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.is_admin()
  )
);

create or replace function public.review_listing_promotion(
  promotion_id uuid,
  decision text,
  note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_listing_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;
  if decision not in ('approved', 'rejected') then
    raise exception 'Invalid promotion review decision';
  end if;

  update public.listing_promotions p
  set status = decision,
      reviewed_at = now(),
      rejection_note = case when decision = 'rejected' then nullif(trim(note), '') else null end
  where p.id = promotion_id
    and p.status = 'pending'
  returning p.listing_id into target_listing_id;

  if target_listing_id is null then
    raise exception 'Pending promotion request not found';
  end if;

  if decision = 'approved' then
    update public.listings set is_featured = true where id = target_listing_id;
  end if;
end;
$$;

revoke all on function public.review_listing_promotion(uuid, text, text) from public;
grant execute on function public.review_listing_promotion(uuid, text, text) to authenticated;

create or replace function public.guard_caution_release_handover()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  owner_id uuid;
  renter_id uuid;
  log_count integer;
begin
  if new.caution_status = 'refunded' and old.caution_status is distinct from new.caution_status then
    select l.owner_id, rr.renter_id
    into owner_id, renter_id
    from public.rental_requests rr
    join public.listings l on l.id = rr.listing_id
    where rr.id = old.id;

    select count(distinct user_id) into log_count
    from public.rental_handover_logs
    where rental_request_id = old.id and phase = 'check_out'
      and user_id in (owner_id, renter_id);

    if log_count < 2 then
      raise exception 'Both rental participants must complete the return handover before refunding the caution';
    end if;
  end if;
  return new;
end;
$$;

create trigger rental_requests_guard_caution_release
before update of caution_status on public.rental_requests
for each row execute function public.guard_caution_release_handover();

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_type text not null check (event_type in ('rental_request', 'rental_status', 'identity_verified', 'promotion_status')),
  title text not null,
  body text not null default '',
  entity_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index notifications_user_unread_idx on public.notifications (user_id, created_at desc) where read_at is null;
alter table public.notifications enable row level security;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy "Users read their own notifications"
on public.notifications for select
to authenticated
using (user_id = (select auth.uid()));

create policy "Users mark their own notifications read"
on public.notifications for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create or replace function public.notify_rental_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  listing_owner uuid;
  listing_title text;
begin
  select l.owner_id, l.title into listing_owner, listing_title
  from public.listings l where l.id = new.listing_id;

  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, event_type, title, body, entity_id)
    values (listing_owner, 'rental_request', 'طلب كراء جديد', 'لديك طلب جديد لإعلان ' || listing_title, new.id);
  elsif new.status is distinct from old.status then
    if new.status = 'approved' then
      insert into public.notifications (user_id, event_type, title, body, entity_id)
      values (new.renter_id, 'rental_status', 'تم قبول طلب الكراء', 'وافق المالك على طلب ' || listing_title, new.id);
    elsif new.status = 'cancelled' then
      insert into public.notifications (user_id, event_type, title, body, entity_id)
      values (new.renter_id, 'rental_status', 'تم تحديث طلب الكراء', 'تم إلغاء طلب ' || listing_title, new.id);
    end if;
  end if;
  return new;
end;
$$;

create trigger rental_requests_notify_insert
after insert on public.rental_requests
for each row execute function public.notify_rental_event();

create trigger rental_requests_notify_status
after update of status on public.rental_requests
for each row execute function public.notify_rental_event();

create or replace function public.notify_identity_verified()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.identity_verified is true and old.identity_verified is distinct from new.identity_verified then
    insert into public.notifications (user_id, event_type, title, body)
    values (new.id, 'identity_verified', 'تم توثيق هويتك', 'تمت مراجعة وثيقة الهوية ومنحك شارة التوثيق.');
  end if;
  return new;
end;
$$;

create trigger profiles_notify_identity_verified
after update of identity_verified on public.profiles
for each row execute function public.notify_identity_verified();

create or replace function public.notify_promotion_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    insert into public.notifications (user_id, event_type, title, body, entity_id)
    values (
      new.owner_id,
      'promotion_status',
      case when new.status = 'approved' then 'تم تمييز إعلانك' else 'تم رفض طلب الترقية' end,
      case when new.status = 'approved' then 'أصبح إعلانك مميزاً على المنصة.' else coalesce(new.rejection_note, 'راجع الإيصال وأعد تقديم الطلب.') end,
      new.listing_id
    );
  end if;
  return new;
end;
$$;

create trigger listing_promotions_notify_review
after update of status on public.listing_promotions
for each row execute function public.notify_promotion_review();

create or replace function public.verify_rental_contract(request_id uuid)
returns table (contract_id text, status text, listing_title text, start_date date, end_date date)
language sql
stable
security definer
set search_path = ''
as $$
  select 'EKR-' || upper(substr(rr.id::text, 1, 12)),
         rr.status::text,
         l.title,
         rr.start_date,
         rr.end_date
  from public.rental_requests rr
  join public.listings l on l.id = rr.listing_id
  where rr.id = request_id
    and rr.status in ('approved', 'active', 'completed');
$$;

revoke all on function public.verify_rental_contract(uuid) from public;
grant execute on function public.verify_rental_contract(uuid) to anon, authenticated;

-- Promotion pricing, payment verification, and expiry.
alter table public.listings
  add column if not exists featured_until timestamptz,
  add column if not exists featured_expiration_notified_at timestamptz;

update public.listings
set is_featured = false
where is_featured is true
  and featured_until is null;

alter table public.listings
  add constraint listings_featured_requires_expiry
  check (is_featured is false or featured_until is not null);

alter table public.listing_promotions
  add column if not exists plan_id text,
  add column if not exists duration_days integer,
  add column if not exists amount_dzd integer,
  add column if not exists payment_method text,
  add column if not exists payment_reference text,
  add column if not exists sender_info text,
  add column if not exists receipt_image_url text;

alter table public.listing_promotions
  add constraint listing_promotions_plan_duration_positive
    check (duration_days is null or duration_days between 1 and 365),
  add constraint listing_promotions_amount_nonnegative
    check (amount_dzd is null or amount_dzd > 0),
  add constraint listing_promotions_payment_method_valid
    check (payment_method is null or payment_method in ('baridimob', 'ccp')),
  add constraint listing_promotions_payment_reference_valid
    check (payment_reference is null or length(trim(payment_reference)) between 4 and 100),
  add constraint listing_promotions_sender_info_valid
    check (sender_info is null or length(trim(sender_info)) between 2 and 120);

update public.listing_promotions
set status = 'rejected',
    reviewed_at = now(),
    rejection_note = 'Legacy promotion request requires resubmission with payment details.'
where status = 'pending'
  and (plan_id is null or duration_days is null or amount_dzd is null
    or payment_method is null or payment_reference is null or sender_info is null
    or receipt_image_url is null);

alter table public.listing_promotions
  add constraint listing_promotions_pending_payment_details_required
  check (
    status <> 'pending'
    or (
      plan_id is not null
      and duration_days is not null
      and amount_dzd is not null
      and payment_method is not null
      and payment_reference is not null
      and sender_info is not null
      and receipt_image_url is not null
    )
  );

create unique index if not exists listing_promotions_payment_reference_unique
  on public.listing_promotions (lower(trim(payment_reference)))
  where payment_reference is not null;

create index if not exists listings_featured_until_idx
  on public.listings (featured_until)
  where is_featured is true;

create table public.platform_settings (
  id text primary key check (id = 'promotion_payments'),
  ccp_account_number text not null default '',
  ccp_key text not null default '',
  baridimob_rip text not null default '',
  account_holder_name text not null default '',
  support_phone text not null default '',
  promotion_plans jsonb not null default '[
    {"id":"plan_7d","name":"باقة 7 أيام - أسبوع","duration_days":7,"amount_dzd":300,"amount_usd":1.5,"enabled":true},
    {"id":"plan_15d","name":"خطة 15 يوم","duration_days":15,"amount_dzd":600,"amount_usd":3,"enabled":true},
    {"id":"plan_30d","name":"خطة 30 يوم - شهر كامل","duration_days":30,"amount_dzd":1000,"amount_usd":5,"enabled":true}
  ]'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

alter table public.platform_settings enable row level security;
grant select on public.platform_settings to authenticated;
grant insert, update on public.platform_settings to authenticated;

create policy "Authenticated users read promotion payment settings"
on public.platform_settings for select
to authenticated
using (true);

create policy "Admins manage promotion payment settings"
on public.platform_settings for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.platform_settings (id)
values ('promotion_payments')
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-promotion-receipts', 'listing-promotion-receipts', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.validate_promotion_plan_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  plan jsonb;
  plan_ids text[];
  plan_count integer := 0;
begin
  if new.ccp_account_number !~ '^[0-9]{1,30}$' and new.ccp_account_number <> '' then
    raise exception 'Invalid CCP account number';
  end if;
  if new.baridimob_rip !~ '^[0-9]{1,40}$' and new.baridimob_rip <> '' then
    raise exception 'Invalid BaridiMob RIP';
  end if;
  if new.ccp_key !~ '^[0-9]{1,40}$' and new.ccp_key <> '' then
    raise exception 'Invalid CCP key';
  end if;
  if length(new.account_holder_name) > 120 or length(new.support_phone) > 40 or length(new.ccp_key) > 40 then
    raise exception 'Payment settings value is too long';
  end if;
  if jsonb_typeof(new.promotion_plans) <> 'array'
     or jsonb_array_length(new.promotion_plans) not between 2 and 10 then
    raise exception 'Promotion plans must contain between two and ten entries';
  end if;

  for plan in select value from jsonb_array_elements(new.promotion_plans)
  loop
    if coalesce(plan->>'id', '') !~ '^[a-z0-9_-]{2,40}$'
       or coalesce(plan->>'name', '') = ''
       or length(plan->>'name') > 100
       or coalesce(plan->>'duration_days', '') !~ '^[0-9]+$'
       or (plan->>'duration_days')::integer not between 1 and 365
       or coalesce(plan->>'amount_dzd', '') !~ '^[0-9]+$'
       or (plan->>'amount_dzd')::integer not between 1 and 100000000
       or coalesce(plan->>'enabled', 'true') not in ('true', 'false') then
      raise exception 'Invalid promotion plan entry';
    end if;
  end loop;

  select array_agg(value->>'id')
  into plan_ids
  from jsonb_array_elements(new.promotion_plans) as plans(value);
  if cardinality(plan_ids) <> (
    select count(distinct plan_id)::integer
    from unnest(plan_ids) as ids(plan_id)
  ) then
    raise exception 'Promotion plan IDs must be unique';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger platform_settings_validate_plans
before insert or update on public.platform_settings
for each row execute function public.validate_promotion_plan_settings();

drop policy if exists "Owners submit promotion requests for own listings" on public.listing_promotions;
revoke insert on public.listing_promotions from authenticated;
revoke update on public.listing_promotions from authenticated;
grant select on public.listing_promotions to authenticated;

create or replace function public.submit_listing_promotion(
  requested_listing_id uuid,
  requested_receipt_path text,
  requested_plan_id text,
  requested_duration_days integer,
  requested_amount_dzd integer,
  requested_payment_method text,
  requested_payment_reference text,
  requested_sender_info text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  selected_plan jsonb;
  promotion_id uuid;
  listing_featured boolean;
begin
  if actor_id is null then
    raise exception 'Authentication required';
  end if;
  if requested_payment_method is null
     or requested_receipt_path is null
     or requested_payment_reference is null
     or requested_sender_info is null
     or requested_payment_method not in ('baridimob', 'ccp')
     or length(trim(requested_payment_reference)) not between 4 and 100
     or length(trim(requested_sender_info)) not between 2 and 120
     or requested_receipt_path not like actor_id::text || '/%' then
    raise exception 'Invalid promotion payment details';
  end if;

  select plans.plan into selected_plan
  from public.platform_settings settings,
       lateral jsonb_array_elements(settings.promotion_plans) as plans(plan)
  where settings.id = 'promotion_payments'
    and plans.plan->>'id' = requested_plan_id
    and coalesce((plans.plan->>'enabled')::boolean, false);

  if selected_plan is null then
    raise exception 'Selected promotion plan is unavailable';
  end if;
  if requested_duration_days is distinct from (selected_plan->>'duration_days')::integer
     or requested_amount_dzd is distinct from (selected_plan->>'amount_dzd')::integer then
    raise exception 'Selected promotion plan price or duration has changed';
  end if;

  select l.is_featured and l.featured_until > now()
  into listing_featured
  from public.listings l
  where l.id = requested_listing_id
    and l.owner_id = actor_id
  for update;
  if not found then
    raise exception 'Listing not found or not owned by the current user';
  end if;
  if listing_featured then
    raise exception 'Listing already has an active promotion';
  end if;
  if exists (
    select 1 from public.listing_promotions p
    where p.listing_id = requested_listing_id and p.status = 'pending'
  ) then
    raise exception 'A promotion request is already pending for this listing';
  end if;

  insert into public.listing_promotions (
    listing_id, owner_id, receipt_path, receipt_image_url,
    plan_id, duration_days, amount_dzd, payment_method,
    payment_reference, sender_info
  ) values (
    requested_listing_id, actor_id, requested_receipt_path, requested_receipt_path,
    requested_plan_id, (selected_plan->>'duration_days')::integer,
    (selected_plan->>'amount_dzd')::integer, requested_payment_method,
    trim(requested_payment_reference), trim(requested_sender_info)
  )
  returning id into promotion_id;
  return promotion_id;
end;
$$;

revoke all on function public.submit_listing_promotion(uuid, text, text, integer, integer, text, text, text) from public;
grant execute on function public.submit_listing_promotion(uuid, text, text, integer, integer, text, text, text) to authenticated;

create or replace function public.review_listing_promotion(
  promotion_id uuid,
  decision text,
  note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_listing_id uuid;
  target_duration_days integer;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;
  if decision not in ('approved', 'rejected') then
    raise exception 'Invalid promotion review decision';
  end if;

  update public.listing_promotions p
  set status = decision,
      reviewed_at = now(),
      rejection_note = case when decision = 'rejected' then nullif(trim(note), '') else null end
  where p.id = promotion_id
    and p.status = 'pending'
  returning p.listing_id, p.duration_days into target_listing_id, target_duration_days;

  if target_listing_id is null then
    raise exception 'Pending promotion request not found';
  end if;

  if decision = 'approved' then
    update public.listings
    set is_featured = true,
        featured_until = now() + make_interval(days => target_duration_days),
        featured_expiration_notified_at = null
    where id = target_listing_id;
  end if;
end;
$$;

revoke all on function public.review_listing_promotion(uuid, text, text) from public;
grant execute on function public.review_listing_promotion(uuid, text, text) to authenticated;

alter table public.notifications
  drop constraint if exists notifications_event_type_check;
alter table public.notifications
  add constraint notifications_event_type_check
  check (event_type in ('rental_request', 'rental_status', 'identity_verified', 'promotion_status', 'featured_expired'));

create or replace function public.expire_featured_listings()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired_count integer;
begin
  with expired as (
    update public.listings l
    set is_featured = false,
        featured_expiration_notified_at = now()
    where l.is_featured is true
      and l.featured_until is not null
      and l.featured_until <= now()
      and l.featured_expiration_notified_at is null
    returning l.id, l.owner_id, l.title, l.featured_until
  ), notifications_created as (
    insert into public.notifications (user_id, event_type, title, body, entity_id)
    select expired.owner_id,
           'featured_expired',
           'انتهت مدة تمييز إعلانك',
           'انتهت باقة تمييز إعلان «' || expired.title || '». يمكنك إرسال طلب ترقية جديد.',
           expired.id
    from expired
    returning id
  )
  select count(*) into expired_count from notifications_created;
  return expired_count;
end;
$$;

revoke all on function public.expire_featured_listings() from public;
grant execute on function public.expire_featured_listings() to anon, authenticated;

-- Hosted projects with pg_cron enabled process expirations hourly. Routes also
-- invoke the idempotent RPC so the fallback works when pg_cron is unavailable.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $job$
      select cron.schedule(
        'ekrrili-expire-featured-listings',
        '5 * * * *',
        'select public.expire_featured_listings()'
      )
      where not exists (
        select 1 from cron.job where jobname = 'ekrrili-expire-featured-listings'
      )
    $job$;
  end if;
end;
$$;

-- Tiered pricing, trust, pro stores, and saved listings.
alter table public.listings
  add column if not exists price_per_week numeric(12, 2),
  add column if not exists price_per_month numeric(12, 2),
  add column if not exists delivery_available boolean not null default false,
  add column if not exists delivery_fee_dzd numeric(12, 2) not null default 0,
  add column if not exists addons jsonb not null default '[]'::jsonb;
alter table public.profiles
  add column if not exists is_pro_store boolean not null default false,
  add column if not exists store_name text,
  add column if not exists store_slug text,
  add column if not exists store_bio text,
  add column if not exists store_wilaya text,
  add column if not exists business_hours jsonb not null default '{}'::jsonb,
  add column if not exists map_location text,
  add column if not exists pro_until timestamptz,
  add constraint profiles_store_slug_format check (store_slug is null or store_slug ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$'),
  add constraint profiles_business_hours_object check (jsonb_typeof(business_hours) = 'object');

alter table public.listings
  add constraint listings_week_price_positive check (price_per_week is null or price_per_week > 0),
  add constraint listings_month_price_positive check (price_per_month is null or price_per_month > 0),
  add constraint listings_delivery_fee_nonnegative check (delivery_fee_dzd >= 0),
  add constraint listings_addons_array check (jsonb_typeof(addons) = 'array');
create or replace function public.validate_listing_rental_options()
returns trigger language plpgsql set search_path = '' as $$
declare
  addon jsonb;
  addon_names text[] := array[]::text[];
  addon_name text;
  addon_price numeric;
begin
  if new.price_per_week is not null and new.price_per_week > new.price_per_day * 7 then
    raise exception 'Weekly price must be discounted against the daily rate';
  end if;
  if new.price_per_month is not null and new.price_per_month > new.price_per_day * 30 then
    raise exception 'Monthly price must be discounted against the daily rate';
  end if;
  if not new.delivery_available and new.delivery_fee_dzd <> 0 then
    raise exception 'Delivery fee requires delivery to be enabled';
  end if;
  if jsonb_typeof(new.addons) is distinct from 'array' then raise exception 'Listing add-ons must be an array'; end if;
  if jsonb_array_length(new.addons) > 20 then raise exception 'A listing can have at most twenty add-ons'; end if;
  for addon in select value from jsonb_array_elements(new.addons)
  loop
    addon_name := trim(coalesce(addon->>'name',''));
    if jsonb_typeof(addon) <> 'object' or length(addon_name) not between 2 and 80
       or coalesce(addon->>'price_per_day_dzd','') !~ '^[0-9]+([.][0-9]{1,2})?$' then
      raise exception 'Invalid listing add-on';
    end if;
    addon_price := (addon->>'price_per_day_dzd')::numeric;
    if addon_price < 0 or addon_price > 100000000 or addon_name = any(addon_names) then
      raise exception 'Add-on prices must be valid and names unique';
    end if;
    addon_names := array_append(addon_names, addon_name);
  end loop;
  return new;
end;
$$;
create trigger listings_validate_rental_options
before insert or update of price_per_day, price_per_week, price_per_month, delivery_available, delivery_fee_dzd, addons
on public.listings for each row execute function public.validate_listing_rental_options();

create unique index if not exists profiles_store_slug_unique
  on public.profiles (store_slug)
  where store_slug is not null;
alter table public.rental_requests
  add column if not exists delivery_method text not null default 'pickup',
  add column if not exists delivery_fee_dzd numeric(12, 2) not null default 0,
  add column if not exists selected_addons jsonb not null default '[]'::jsonb,
  add column if not exists pricing_breakdown jsonb not null default '{}'::jsonb;

alter table public.rental_requests
  add constraint rental_requests_delivery_method_valid check (delivery_method in ('pickup', 'delivery')),
  add constraint rental_requests_delivery_fee_nonnegative check (delivery_fee_dzd >= 0),
  add constraint rental_requests_selected_addons_array check (jsonb_typeof(selected_addons) = 'array'),
  add constraint rental_requests_pricing_breakdown_object check (jsonb_typeof(pricing_breakdown) = 'object');

create or replace function public.prepare_rental_request()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  listing_record record;
  rental_days integer;
  monthly_blocks integer;
  weekly_blocks integer;
  daily_blocks integer;
  base_total numeric(12,2);
  addons_total numeric(12,2) := 0;
  addon jsonb;
  allowed_addon jsonb;
begin
  select l.owner_id, l.status, l.price_per_day, l.price_per_week, l.price_per_month,
         l.caution_deposit_amount, l.caution_type, l.delivery_available, l.delivery_fee_dzd, l.addons
  into listing_record
  from public.listings as l
  where l.id = new.listing_id;

  if not found then raise exception 'Listing does not exist'; end if;
  if listing_record.owner_id = new.renter_id then raise exception 'Listing owners cannot rent their own listing'; end if;
  if listing_record.status <> 'active' then raise exception 'Only active listings can be requested'; end if;
  if new.status <> 'pending' then raise exception 'New rental requests must start as pending'; end if;
  rental_days := new.end_date - new.start_date;
  if rental_days < 1 then raise exception 'Rental dates are invalid'; end if;

  monthly_blocks := case when listing_record.price_per_month is not null then rental_days / 30 else 0 end;
  weekly_blocks := case when listing_record.price_per_week is not null then (rental_days - monthly_blocks * 30) / 7 else 0 end;
  daily_blocks := rental_days - monthly_blocks * 30 - weekly_blocks * 7;
  base_total := monthly_blocks * coalesce(listing_record.price_per_month, 0)
    + weekly_blocks * coalesce(listing_record.price_per_week, 0)
    + daily_blocks * listing_record.price_per_day;

  if new.delivery_method = 'delivery' then
    if not listing_record.delivery_available then raise exception 'Delivery is unavailable for this listing'; end if;
    new.delivery_fee_dzd := listing_record.delivery_fee_dzd;
  else
    new.delivery_fee_dzd := 0;
  end if;
  for addon in select value from jsonb_array_elements(new.selected_addons)
  loop
    select value into allowed_addon
    from jsonb_array_elements(listing_record.addons)
    where value->>'name' = addon->>'name'
      and (value->>'price_per_day_dzd')::numeric = (addon->>'price_per_day_dzd')::numeric
    limit 1;
    if allowed_addon is null then raise exception 'Selected add-on is unavailable'; end if;
    addons_total := addons_total + (allowed_addon->>'price_per_day_dzd')::numeric * rental_days;
  end loop;
  if new.total_price <> base_total + addons_total + new.delivery_fee_dzd then
    raise exception 'Total price does not match the listing rates and selected options';
  end if;

  new.pricing_breakdown := jsonb_build_object(
    'rental_days', rental_days,
    'daily_total', listing_record.price_per_day * rental_days,
    'base_total', base_total,
    'addons_total', addons_total,
    'delivery_fee_dzd', new.delivery_fee_dzd
  );

  create policy "Admins read all rental handover logs"
  on public.rental_handover_logs for select to authenticated
  using (public.is_admin());
  create policy "Admins read rental handover photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'rental-handover-photos' and public.is_admin());
  new.caution_deposit_amount := listing_record.caution_deposit_amount;
  new.caution_type := listing_record.caution_type;
  new.caution_status := case when listing_record.caution_deposit_amount = 0 then 'not_required'::public.caution_status else 'pending'::public.caution_status end;
  return new;
end;
$$;

create or replace function public.get_rental_agreement(request_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  select jsonb_build_object(
    'contractId', 'EKR-' || upper(substr(rr.id::text, 1, 12)),
    'generatedAt', now(),
    'status', rr.status,
    'owner', jsonb_build_object('fullName', owner_profile.full_name, 'phoneNumber', coalesce(owner_profile.phone_number, 'غير مسجل')),
    'renter', jsonb_build_object('fullName', renter_profile.full_name, 'phoneNumber', coalesce(renter_profile.phone_number, 'غير مسجل')),
    'item', jsonb_build_object(
      'title', l.title, 'condition', l.item_condition,
      'accessories', case when jsonb_typeof(l.metadata -> 'accessories') = 'array' then l.metadata -> 'accessories' else '[]'::jsonb end
    ),
    'caution', jsonb_build_object(
      'amountDzd', rr.caution_deposit_amount, 'type', rr.caution_type,
      'reimbursementTerms', rr.caution_reimbursement_terms
    ),
    'rental', jsonb_build_object(
      'pickupAt', rr.pickup_at, 'returnAt', rr.return_at, 'totalCostDzd', rr.total_price,
      'damageTerms', rr.damage_terms, 'lateReturnTerms', rr.late_return_terms,
      'deliveryMethod', rr.delivery_method, 'deliveryFeeDzd', rr.delivery_fee_dzd,
      'selectedAddons', rr.selected_addons, 'pricingBreakdown', rr.pricing_breakdown
    )
  ) into result
  from public.rental_requests rr
  join public.listings l on l.id = rr.listing_id
  join public.profiles owner_profile on owner_profile.id = l.owner_id
  join public.profiles renter_profile on renter_profile.id = rr.renter_id
  where rr.id = request_id and rr.status in ('approved','active','completed')
    and (rr.renter_id = (select auth.uid()) or l.owner_id = (select auth.uid()) or public.is_admin());
  if result is null then raise exception 'Confirmed rental agreement not found or access denied'; end if;
  return result;
end;
$$;
revoke all on function public.get_rental_agreement(uuid) from public;
grant execute on function public.get_rental_agreement(uuid) to authenticated;

create or replace view public.public_profiles
with (security_barrier = true)
as
select p.id, p.full_name, p.identity_verified, p.rating, p.avatar_url, p.wilaya, p.created_at,
  p.is_pro_store, p.store_name, p.store_slug, p.store_bio, p.store_wilaya, p.business_hours, p.map_location, p.pro_until,
  case when p.is_pro_store then p.phone_number else null end as store_phone,
  (select count(*) from public.rental_requests rr where rr.renter_id = p.id and rr.status = 'completed')::integer as completed_rentals
from public.profiles p;

create table public.listing_favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
alter table public.listing_favorites enable row level security;
grant select, insert, delete on public.listing_favorites to authenticated;
create policy "Users manage their own listing favorites"
  on public.listing_favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table public.dispute_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_user_id uuid references public.profiles(id) on delete set null,
  listing_id uuid references public.listings(id) on delete set null,
  rental_request_id uuid references public.rental_requests(id) on delete set null,
  reason text not null check (reason in ('damage','late_return','no_show','fraud','other')),
  details text not null check (length(trim(details)) between 10 and 3000),
  status text not null default 'pending' check (status in ('pending','reviewing','resolved','dismissed')),
  admin_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index dispute_reports_queue_idx on public.dispute_reports(status, created_at desc);
create index dispute_reports_request_idx on public.dispute_reports(rental_request_id) where rental_request_id is not null;
alter table public.dispute_reports enable row level security;
grant select, insert, update on public.dispute_reports to authenticated;
create policy "Users read reports they submitted"
  on public.dispute_reports for select to authenticated using (reporter_id = auth.uid() or public.is_admin());
create policy "Participants can submit reports"
  on public.dispute_reports for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and (
      (rental_request_id is not null and exists (
        select 1 from public.rental_requests r
        join public.listings l on l.id = r.listing_id
        where r.id = rental_request_id and (r.renter_id = auth.uid() or l.owner_id = auth.uid())
      ))
      or (listing_id is not null and exists (select 1 from public.listings l where l.id = listing_id and (l.owner_id = auth.uid() or l.status = 'active')))
    )
    and (
      target_user_id is null
      or (rental_request_id is not null and exists (
        select 1 from public.rental_requests r join public.listings l on l.id = r.listing_id
        where r.id = rental_request_id and target_user_id in (r.renter_id, l.owner_id)
      ))
      or (listing_id is not null and exists (
        select 1 from public.listings l where l.id = listing_id and target_user_id = l.owner_id
      ))
    )
  );
create policy "Admins manage dispute reports"
  on public.dispute_reports for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create table public.pro_store_applications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  store_name text not null check (length(trim(store_name)) between 2 and 120),
  store_slug text not null check (store_slug ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$'),
  store_bio text not null default '' check (length(store_bio) <= 2000),
  business_hours jsonb not null default '{}'::jsonb check (jsonb_typeof(business_hours) = 'object'),
  map_location text,
  receipt_path text not null,
  payment_reference text not null check (length(trim(payment_reference)) between 4 and 100),
  pro_days integer not null check (pro_days between 30 and 365),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  rejection_note text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create unique index pro_store_application_reference_unique on public.pro_store_applications(lower(trim(payment_reference)));
create index pro_store_applications_queue_idx on public.pro_store_applications(status, submitted_at desc);
alter table public.pro_store_applications enable row level security;
grant select, insert, update on public.pro_store_applications to authenticated;
create policy "Owners and admins read pro store applications"
  on public.pro_store_applications for select to authenticated using (owner_id = auth.uid() or public.is_admin());
create policy "Owners apply for pro stores"
  on public.pro_store_applications for insert to authenticated with check (owner_id = auth.uid());
create policy "Admins review pro store applications"
  on public.pro_store_applications for update to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pro-store-receipts','pro-store-receipts',false,8388608,array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
create policy "Owners upload pro store receipts"
on storage.objects for insert to authenticated
with check (bucket_id = 'pro-store-receipts' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Owners and admins read pro store receipts"
on storage.objects for select to authenticated using (
  bucket_id = 'pro-store-receipts'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);

create or replace function public.review_pro_store_application(application_id uuid, decision text, rejection_message text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  application public.pro_store_applications%rowtype;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if decision not in ('approved','rejected') then raise exception 'Invalid review decision'; end if;
  select * into application from public.pro_store_applications where id = application_id and status = 'pending' for update;
  if not found then raise exception 'Pending application not found'; end if;
  if decision = 'approved' and exists(select 1 from public.profiles where store_slug = application.store_slug and id <> application.owner_id) then
    raise exception 'Store URL is already in use';
  end if;
  update public.pro_store_applications set status = decision, rejection_note = case when decision = 'rejected' then nullif(trim(rejection_message),'') end, reviewed_at = now() where id = application_id;
  if decision = 'approved' then
    update public.profiles set is_pro_store = true, store_name = application.store_name, store_slug = application.store_slug,
      store_bio = application.store_bio, store_wilaya = application.wilaya, business_hours = application.business_hours, map_location = application.map_location,
      pro_until = now() + make_interval(days => application.pro_days)
    where id = application.owner_id;
  end if;
end;
$$;
revoke all on function public.review_pro_store_application(uuid,text,text) from public;
grant execute on function public.review_pro_store_application(uuid,text,text) to authenticated;

-- 20261015140000_interactive_checkout_gateway.sql
alter table public.platform_settings
  add column if not exists bybit_uid text not null default '',
  add column if not exists bybit_pay_qr_url text not null default '',
  add column if not exists usdt_wallet_address text not null default '';

update public.platform_settings settings
set promotion_plans = (
  select jsonb_agg(jsonb_build_object(
    'id', case plan->>'id' when '15_days' then 'plan_15d' when '30_days' then 'plan_30d' else plan->>'id' end,
    'name', coalesce(nullif(plan->>'name', ''), case when plan->>'id' in ('15_days', 'plan_15d') then 'خطة 15 يوم' else 'خطة شهر كامل' end),
    'duration_days', case when plan->>'id' in ('15_days', 'plan_15d') then 15 else 30 end,
    'amount_dzd', coalesce((plan->>'amount_dzd')::integer, case when plan->>'id' in ('15_days', 'plan_15d') then 600 else 1000 end),
    'amount_usd', coalesce((plan->>'amount_usd')::numeric, case when plan->>'id' in ('15_days', 'plan_15d') then 3 else 5 end),
    'enabled', coalesce((plan->>'enabled')::boolean, true)
  ) order by case when plan->>'id' in ('15_days', 'plan_15d') then 1 else 2 end)
  from jsonb_array_elements(settings.promotion_plans) as plans(plan)
  where plan->>'id' in ('15_days', '30_days', 'plan_15d', 'plan_30d')
)
where id = 'promotion_payments'
  and (select count(*) from jsonb_array_elements(settings.promotion_plans) plans(plan)
       where plan->>'id' in ('15_days', '30_days', 'plan_15d', 'plan_30d')) = 2;

update public.platform_settings
set promotion_plans = '[
  {"id":"plan_15d","name":"خطة 15 يوم","duration_days":15,"amount_dzd":600,"amount_usd":3,"enabled":true},
  {"id":"plan_30d","name":"خطة شهر كامل","duration_days":30,"amount_dzd":1000,"amount_usd":5,"enabled":true}
]'::jsonb
where id = 'promotion_payments' and (
  select count(*) from jsonb_array_elements(promotion_plans) plans(plan)
  where plan->>'id' in ('plan_15d', 'plan_30d')
) <> 2;

create or replace function public.validate_promotion_plan_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  plan jsonb;
  plan_ids text[];
  plan_count integer := 0;
  distinct_plan_count integer;
begin
  if new.ccp_account_number !~ '^[0-9]{1,30}$' and new.ccp_account_number <> '' then raise exception 'Invalid CCP account number'; end if;
  if new.baridimob_rip !~ '^[0-9]{1,40}$' and new.baridimob_rip <> '' then raise exception 'Invalid BaridiMob RIP'; end if;
  if new.ccp_key !~ '^[0-9]{1,40}$' and new.ccp_key <> '' then raise exception 'Invalid CCP key'; end if;
  if length(new.account_holder_name) > 120 or length(new.support_phone) > 40 or length(new.ccp_key) > 40
     or length(new.bybit_uid) > 80 or length(new.usdt_wallet_address) > 120
     or length(new.bybit_pay_qr_url) > 2048 then
    raise exception 'Payment settings value is too long';
  end if;
  if new.bybit_pay_qr_url <> '' and new.bybit_pay_qr_url !~ '^https://[^[:space:]]+$' then
    raise exception 'Bybit Pay QR URL must use HTTPS';
  end if;
  if jsonb_typeof(new.promotion_plans) is distinct from 'array'
     or jsonb_array_length(new.promotion_plans) not between 2 and 5 then
    raise exception 'Between two and five promotion plans are required';
  end if;
  for plan in select value from jsonb_array_elements(new.promotion_plans)
  loop
    plan_count := plan_count + 1;
    if coalesce(plan->>'id', '') not in ('plan_7d', 'plan_15d', 'plan_30d')
       or coalesce(plan->>'name', '') = '' or length(plan->>'name') > 100
       or coalesce(plan->>'duration_days', '') !~ '^[0-9]+$'
       or (plan->>'duration_days')::integer not between 1 and 365
       or coalesce(plan->>'amount_dzd', '') !~ '^[0-9]+$'
       or (plan->>'amount_dzd')::integer not between 1 and 100000000
       or coalesce(plan->>'amount_usd', '') !~ '^[0-9]+([.][0-9]{1,2})?$'
       or (plan->>'amount_usd')::numeric not between 0.01 and 100000
       or coalesce(plan->>'enabled', 'true') not in ('true', 'false') then
      raise exception 'Invalid promotion plan entry';
    end if;
  end loop;
  select array_agg(value->>'id') into plan_ids from jsonb_array_elements(new.promotion_plans) as plans(value);
  select count(distinct value->>'id') into distinct_plan_count
  from jsonb_array_elements(new.promotion_plans) as plans(value);
  if cardinality(plan_ids) <> plan_count or distinct_plan_count <> plan_count then
    raise exception 'Promotion plan IDs must be unique';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

alter table public.listing_promotions
  alter column receipt_path drop not null,
  add column if not exists currency text not null default 'DZD',
  add column if not exists amount_usd numeric(12, 2);
alter table public.listing_promotions
  drop constraint if exists listing_promotions_payment_method_valid,
  drop constraint if exists listing_promotions_pending_payment_details_required;

update public.listing_promotions
set status = 'rejected',
    reviewed_at = now(),
    rejection_note = 'Legacy promotion plan is no longer available; please resubmit.'
where status = 'pending' and plan_id not in ('15_days', '30_days', 'plan_15d', 'plan_30d');
update public.listing_promotions
set plan_id = case plan_id when '15_days' then 'plan_15d' when '30_days' then 'plan_30d' else plan_id end
where plan_id in ('15_days', '30_days');

alter table public.listing_promotions
  add constraint listing_promotions_payment_method_valid check (payment_method is null or payment_method in ('baridimob', 'ccp', 'bybit')),
  add constraint listing_promotions_currency_valid check (currency in ('DZD', 'USD')),
  add constraint listing_promotions_amount_usd_positive check (amount_usd is null or amount_usd > 0),
  add constraint listing_promotions_pending_payment_details_required check (
    status <> 'pending'
    or (
      plan_id in ('plan_15d', 'plan_30d')
      and duration_days is not null
      and payment_method is not null
      and payment_reference is not null
      and sender_info is not null
      and (
        (currency = 'DZD' and amount_dzd is not null and amount_usd is null and payment_method in ('baridimob', 'ccp') and receipt_image_url is not null)
        or (currency = 'USD' and amount_usd is not null and amount_dzd is null and payment_method = 'bybit')
      )
    )
  );

drop function if exists public.submit_listing_promotion(uuid, text, text, integer, integer, text, text, text);
create function public.submit_listing_promotion(
  requested_listing_id uuid,
  requested_receipt_path text,
  requested_plan_id text,
  requested_duration_days integer,
  requested_currency text,
  requested_amount numeric,
  requested_payment_method text,
  requested_payment_reference text,
  requested_sender_info text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  selected_plan jsonb;
  promotion_id uuid;
  listing_featured boolean;
begin
  if actor_id is null then raise exception 'Authentication required'; end if;
  if requested_currency is null or requested_currency not in ('DZD', 'USD')
     or requested_payment_method is null
     or requested_amount is null or requested_amount <= 0
     or requested_duration_days is null
     or (requested_currency = 'DZD' and requested_payment_method not in ('baridimob', 'ccp'))
     or (requested_currency = 'USD' and requested_payment_method <> 'bybit')
     or (requested_currency = 'DZD' and requested_receipt_path is null)
     or requested_receipt_path is not null and requested_receipt_path not like actor_id::text || '/%'
     or length(trim(coalesce(requested_payment_reference, ''))) not between 4 and 100
     or length(trim(coalesce(requested_sender_info, ''))) not between 2 and 120 then
    raise exception 'Invalid promotion payment details';
  end if;
  select plans.plan into selected_plan
  from public.platform_settings settings,
       lateral jsonb_array_elements(settings.promotion_plans) as plans(plan)
  where settings.id = 'promotion_payments'
    and plans.plan->>'id' = requested_plan_id
    and coalesce((plans.plan->>'enabled')::boolean, false);
  if selected_plan is null then raise exception 'Selected promotion plan is unavailable'; end if;
  if requested_duration_days is distinct from (selected_plan->>'duration_days')::integer
     or (requested_currency = 'DZD' and requested_amount is distinct from (selected_plan->>'amount_dzd')::numeric)
     or (requested_currency = 'USD' and requested_amount is distinct from (selected_plan->>'amount_usd')::numeric) then
    raise exception 'Selected promotion plan price or duration has changed';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(lower(trim(requested_payment_reference)), 0));
  if exists (
    select 1 from public.pro_store_applications a
    where lower(trim(a.payment_reference)) = lower(trim(requested_payment_reference))
  ) then
    raise exception 'Payment reference has already been submitted';
  end if;
  select l.is_featured and l.featured_until > now() into listing_featured
  from public.listings l where l.id = requested_listing_id and l.owner_id = actor_id for update;
  if not found then raise exception 'Listing not found or not owned by the current user'; end if;
  if listing_featured then raise exception 'Listing already has an active promotion'; end if;
  if exists (select 1 from public.listing_promotions p where p.listing_id = requested_listing_id and p.status = 'pending') then
    raise exception 'A promotion request is already pending for this listing';
  end if;
  insert into public.listing_promotions (
    listing_id, owner_id, receipt_path, receipt_image_url, plan_id, duration_days,
    amount_dzd, amount_usd, currency, payment_method, payment_reference, sender_info
  ) values (
    requested_listing_id, actor_id, requested_receipt_path, requested_receipt_path, requested_plan_id,
    (selected_plan->>'duration_days')::integer,
    case when requested_currency = 'DZD' then requested_amount::integer end,
    case when requested_currency = 'USD' then requested_amount end,
    requested_currency, requested_payment_method, trim(requested_payment_reference), trim(requested_sender_info)
  ) returning id into promotion_id;
  return promotion_id;
end;
$$;
revoke all on function public.submit_listing_promotion(uuid, text, text, integer, text, numeric, text, text, text) from public;
grant execute on function public.submit_listing_promotion(uuid, text, text, integer, text, numeric, text, text, text) to authenticated;

alter table public.pro_store_applications
  alter column receipt_path drop not null,
  add column if not exists plan_id text,
  add column if not exists currency text not null default 'DZD',
  add column if not exists amount_dzd integer,
  add column if not exists amount_usd numeric(12, 2),
  add column if not exists payment_method text,
  add column if not exists sender_info text;
alter table public.pro_store_applications
  drop constraint if exists pro_store_applications_pro_days_check,
  add constraint pro_store_applications_pro_days_check check (pro_days between 1 and 365);
alter table public.pro_store_applications
  add constraint pro_store_applications_checkout_plan check (
    plan_id is null or plan_id in ('plan_15d', 'plan_30d')
  ),
  add constraint pro_store_applications_currency_valid check (currency in ('DZD', 'USD')),
  add constraint pro_store_applications_payment_method_valid check (payment_method is null or payment_method in ('baridimob', 'ccp', 'bybit')),
  add constraint pro_store_applications_checkout_amount_valid check (
    plan_id is null or (
      (currency = 'DZD' and amount_dzd > 0 and amount_usd is null and payment_method in ('baridimob', 'ccp') and receipt_path is not null)
      or (currency = 'USD' and amount_usd > 0 and amount_dzd is null and payment_method = 'bybit')
    )
  );

drop policy if exists "Owners apply for pro stores" on public.pro_store_applications;
revoke insert on public.pro_store_applications from authenticated;
create or replace function public.submit_pro_store_application(
  requested_store_name text,
  requested_store_slug text,
  requested_store_bio text,
  requested_business_hours jsonb,
  requested_wilaya text,
  requested_map_location text,
  requested_receipt_path text,
  requested_payment_reference text,
  requested_sender_info text,
  requested_plan_id text,
  requested_currency text,
  requested_amount numeric,
  requested_payment_method text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  selected_plan jsonb;
  application_id uuid;
begin
  if actor_id is null then raise exception 'Authentication required'; end if;
  if length(trim(coalesce(requested_store_name, ''))) not between 2 and 120
     or coalesce(requested_store_slug, '') !~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$'
     or length(coalesce(requested_store_bio, '')) > 2000
     or jsonb_typeof(requested_business_hours) is distinct from 'object'
     or length(trim(coalesce(requested_wilaya, ''))) not between 1 and 100
     or length(trim(coalesce(requested_payment_reference, ''))) not between 4 and 100
     or length(trim(coalesce(requested_sender_info, ''))) not between 2 and 120
     or requested_currency is null or requested_currency not in ('DZD', 'USD')
     or requested_payment_method is null
     or (requested_currency = 'DZD' and requested_payment_method not in ('baridimob', 'ccp'))
     or (requested_currency = 'USD' and requested_payment_method <> 'bybit')
     or (requested_currency = 'DZD' and requested_receipt_path is null)
     or requested_receipt_path is not null and requested_receipt_path not like actor_id::text || '/%' then
    raise exception 'Invalid Pro Store payment details';
  end if;
  select plans.plan into selected_plan
  from public.platform_settings settings,
       lateral jsonb_array_elements(settings.promotion_plans) as plans(plan)
  where settings.id = 'promotion_payments'
    and plans.plan->>'id' = requested_plan_id
    and coalesce((plans.plan->>'enabled')::boolean, false);
  if selected_plan is null
     or requested_amount is distinct from (case when requested_currency = 'DZD'
       then (selected_plan->>'amount_dzd')::numeric else (selected_plan->>'amount_usd')::numeric end) then
    raise exception 'Selected Pro Store plan is unavailable or changed';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(lower(trim(requested_payment_reference)), 0));
  if exists (
    select 1 from public.listing_promotions p
    where lower(trim(p.payment_reference)) = lower(trim(requested_payment_reference))
  ) then
    raise exception 'Payment reference has already been submitted';
  end if;
  if exists (select 1 from public.pro_store_applications a where a.status = 'pending' and a.owner_id = actor_id) then
    raise exception 'A Pro Store application is already pending';
  end if;
  if exists (select 1 from public.profiles p where p.store_slug = requested_store_slug and p.id <> actor_id)
     or exists (select 1 from public.pro_store_applications a where a.store_slug = requested_store_slug and a.status = 'pending') then
    raise exception 'Store URL is already in use';
  end if;
  insert into public.pro_store_applications (
    owner_id, store_name, store_slug, store_bio, business_hours, wilaya, map_location,
    receipt_path, payment_reference, sender_info, plan_id, currency, amount_dzd, amount_usd,
    payment_method, pro_days
  ) values (
    actor_id, trim(requested_store_name), requested_store_slug, coalesce(requested_store_bio, ''),
    requested_business_hours, trim(requested_wilaya), nullif(trim(coalesce(requested_map_location, '')), ''),
    requested_receipt_path, trim(requested_payment_reference), trim(requested_sender_info), requested_plan_id,
    requested_currency,
    case when requested_currency = 'DZD' then requested_amount::integer end,
    case when requested_currency = 'USD' then requested_amount end,
    requested_payment_method, (selected_plan->>'duration_days')::integer
  ) returning id into application_id;
  return application_id;
end;
$$;
revoke all on function public.submit_pro_store_application(text,text,text,jsonb,text,text,text,text,text,text,text,numeric,text) from public;
grant execute on function public.submit_pro_store_application(text,text,text,jsonb,text,text,text,text,text,text,text,numeric,text) to authenticated;

-- Ekrrili is a classifieds publisher, not a payment, rental, or handover intermediary.
-- Preserve historical records, but disable new platform-mediated transaction activity.

drop policy if exists "Users request active listings as renters" on public.rental_requests;
drop policy if exists "Listing owners update rental request status" on public.rental_requests;
drop policy if exists "Renters cancel their own pending or approved requests" on public.rental_requests;
revoke insert, update, delete on public.rental_requests from authenticated;

drop policy if exists "Participants review completed rentals" on public.reviews;
revoke insert on public.reviews from authenticated;

drop policy if exists "Participants write their own handover logs" on public.rental_handover_logs;
revoke insert, update, delete on public.rental_handover_logs from authenticated;
drop policy if exists "Participants upload handover photos" on storage.objects;

drop policy if exists "Owners apply for pro stores" on public.pro_store_applications;
revoke insert, update, delete on public.pro_store_applications from authenticated;
revoke all on function public.submit_pro_store_application(text,text,text,jsonb,text,text,text,text,text,text,text,numeric,text) from public, authenticated;
revoke all on function public.review_pro_store_application(uuid,text,text) from public, authenticated;
drop policy if exists "Owners upload pro store receipts" on storage.objects;
drop policy if exists "Owners and admins read pro store receipts" on storage.objects;
revoke insert, update, delete on public.listing_promotions from authenticated;
revoke all on function public.submit_listing_promotion(uuid, text, text, integer, text, numeric, text, text, text) from public, authenticated;
revoke all on function public.review_listing_promotion(uuid, text, text) from public, authenticated;
drop policy if exists "Owners upload their promotion receipts" on storage.objects;
drop policy if exists "Owners and admins read promotion receipts" on storage.objects;

drop policy if exists "Admins manage promotion payment settings" on public.platform_settings;
drop policy if exists "Authenticated users read promotion payment settings" on public.platform_settings;
revoke select, insert, update, delete on public.platform_settings from authenticated;
update public.platform_settings
set ccp_account_number = '',
    ccp_key = '',
    baridimob_rip = '',
    account_holder_name = '',
    bybit_uid = '',
    bybit_pay_qr_url = '',
    usdt_wallet_address = ''
where id = 'promotion_payments';

drop policy if exists "Owners create their own blackout dates" on public.listing_blackout_dates;
drop policy if exists "Owners remove their own blackout dates" on public.listing_blackout_dates;
revoke insert, update, delete on public.listing_blackout_dates from authenticated;
revoke all on function public.get_listing_unavailable_dates(uuid, date, date) from public, anon, authenticated;
revoke all on function public.is_listing_available(uuid, date, date) from public, anon, authenticated;
revoke all on function public.get_rental_agreement(uuid) from public, anon, authenticated;
revoke all on function public.verify_rental_contract(uuid) from public, anon, authenticated;

update public.profiles
set is_pro_store = false,
    pro_until = null;

create or replace function public.prevent_classified_only_privileged_field_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_table_name = 'listings' then
      if new.is_featured is distinct from old.is_featured
         or new.featured_until is distinct from old.featured_until then
        raise exception 'Only administrators can change featured listing status';
      end if;
    elsif tg_table_name = 'profiles' then
      if new.is_pro_store is distinct from old.is_pro_store
         or new.pro_until is distinct from old.pro_until
         or new.store_name is distinct from old.store_name
         or new.store_slug is distinct from old.store_slug
         or new.store_bio is distinct from old.store_bio
         or new.store_wilaya is distinct from old.store_wilaya
         or new.business_hours is distinct from old.business_hours
         or new.map_location is distinct from old.map_location then
        raise exception 'Pro Store subscriptions are not available';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_owner_featured_listing_changes on public.listings;
create trigger prevent_owner_featured_listing_changes
before update on public.listings
for each row execute function public.prevent_classified_only_privileged_field_changes();

drop trigger if exists prevent_user_pro_store_changes on public.profiles;
create trigger prevent_user_pro_store_changes
before update on public.profiles
for each row execute function public.prevent_classified_only_privileged_field_changes();

comment on table public.rental_requests is
  'Legacy rental-request records retained for reference; classified-only mode disables new requests and status changes.';
comment on table public.listing_promotions is
  'Legacy promotion-payment records retained for reference; classified-only mode disables paid promotions.';
comment on table public.pro_store_applications is
  'Legacy Pro Store subscription records retained for reference; classified-only mode disables paid applications.';
-- Monetization is limited to paid platform advertising and Pro Store subscriptions.
-- Rental requests, deposits, handovers, and peer-to-peer payments remain disabled.

insert into public.platform_settings (id)
values ('promotion_payments')
on conflict (id) do nothing;

update public.platform_settings
set promotion_plans = '[
  {"id":"plan_15d","name":"خطة 15 يوم","duration_days":15,"amount_dzd":600,"amount_usd":3,"enabled":true},
  {"id":"plan_30d","name":"خطة 30 يوم - شهر كامل","duration_days":30,"amount_dzd":1000,"amount_usd":5,"enabled":true}
]'::jsonb
where id = 'promotion_payments'
  and (
    select count(*) from jsonb_array_elements(promotion_plans) as plans(plan)
    where plan->>'id' in ('plan_15d', 'plan_30d')
  ) <> 2;

update public.platform_settings settings
set promotion_plans = (
  select jsonb_agg(
    jsonb_set(plan, '{name}', to_jsonb(case plan->>'id'
      when 'plan_15d' then 'خطة 15 يوم'
      else 'خطة 30 يوم - شهر كامل'
    end))
    order by case plan->>'id' when 'plan_15d' then 1 else 2 end
  )
  from jsonb_array_elements(settings.promotion_plans) as plans(plan)
  where plan->>'id' in ('plan_15d', 'plan_30d')
)
where id = 'promotion_payments'
  and (select count(*) from jsonb_array_elements(settings.promotion_plans) as plans(plan)
       where plan->>'id' in ('plan_15d', 'plan_30d')) = 2;

drop policy if exists "Authenticated users read promotion payment settings" on public.platform_settings;
drop policy if exists "Admins manage promotion payment settings" on public.platform_settings;
create policy "Authenticated users read promotion payment settings"
on public.platform_settings for select to authenticated
using (true);
create policy "Admins manage promotion payment settings"
on public.platform_settings for all to authenticated
using (public.is_admin())
with check (public.is_admin());
grant select, insert, update on public.platform_settings to authenticated;
revoke delete on public.platform_settings from authenticated;
alter table public.profiles
  add column if not exists pro_expiration_notified_at timestamptz;

create or replace function public.validate_fixed_subscription_plan_durations()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  plan jsonb;
  plan_count integer := 0;
begin
  if jsonb_typeof(new.promotion_plans) is distinct from 'array'
     or jsonb_array_length(new.promotion_plans) <> 2 then
    raise exception 'Exactly two platform subscription plans are required';
  end if;
  for plan in select value from jsonb_array_elements(new.promotion_plans)
  loop
    plan_count := plan_count + 1;
    if (plan->>'id' = 'plan_15d' and ((plan->>'duration_days')::integer <> 15 or plan->>'name' <> 'خطة 15 يوم'))
       or (plan->>'id' = 'plan_30d' and ((plan->>'duration_days')::integer <> 30 or plan->>'name' <> 'خطة 30 يوم - شهر كامل'))
       or plan->>'id' not in ('plan_15d', 'plan_30d') then
      raise exception 'The official plan durations are fixed at 15 and 30 days';
    end if;
  end loop;
  return new;
end;
$$;
drop trigger if exists platform_settings_fixed_plan_durations on public.platform_settings;
create trigger platform_settings_fixed_plan_durations
before insert or update of promotion_plans on public.platform_settings
for each row execute function public.validate_fixed_subscription_plan_durations();

drop policy if exists "Owners and admins read promotion requests" on public.listing_promotions;
drop policy if exists "Owners submit promotion requests for own listings" on public.listing_promotions;
drop policy if exists "Admins review promotion requests" on public.listing_promotions;
create policy "Owners and admins read promotion requests"
on public.listing_promotions for select to authenticated
using (owner_id = (select auth.uid()) or public.is_admin());
create policy "Owners submit promotion requests for own listings"
on public.listing_promotions for insert to authenticated
with check (
  owner_id = (select auth.uid())
  and status = 'pending'
  and exists (
    select 1 from public.listings listing
    where listing.id = listing_id and listing.owner_id = (select auth.uid())
  )
);
create policy "Admins review promotion requests"
on public.listing_promotions for update to authenticated
using (public.is_admin())
with check (public.is_admin());
grant select on public.listing_promotions to authenticated;
revoke insert, update, delete on public.listing_promotions from authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-promotion-receipts', 'listing-promotion-receipts', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "Owners upload their promotion receipts" on storage.objects;
drop policy if exists "Owners and admins read promotion receipts" on storage.objects;
create policy "Owners upload their promotion receipts"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'listing-promotion-receipts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.profiles profile where profile.id = (select auth.uid()) and profile.is_suspended is false)
);
create policy "Owners and admins read promotion receipts"
on storage.objects for select to authenticated
using (
  bucket_id = 'listing-promotion-receipts'
  and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin())
);

drop policy if exists "Owners and admins read pro store applications" on public.pro_store_applications;
drop policy if exists "Owners apply for pro stores" on public.pro_store_applications;
drop policy if exists "Admins review pro store applications" on public.pro_store_applications;
create policy "Owners and admins read pro store applications"
on public.pro_store_applications for select to authenticated
using (owner_id = (select auth.uid()) or public.is_admin());
create policy "Admins review pro store applications"
on public.pro_store_applications for update to authenticated
using (public.is_admin())
with check (public.is_admin());
grant select, update on public.pro_store_applications to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pro-store-receipts', 'pro-store-receipts', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "Owners upload pro store receipts" on storage.objects;
drop policy if exists "Owners and admins read pro store receipts" on storage.objects;
create policy "Owners upload pro store receipts"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'pro-store-receipts'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (select 1 from public.profiles profile where profile.id = (select auth.uid()) and profile.is_suspended is false)
);
create policy "Owners and admins read pro store receipts"
on storage.objects for select to authenticated
using (
  bucket_id = 'pro-store-receipts'
  and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin())
);

create or replace function public.guard_subscription_payment_submission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  suspended boolean;
begin
  if auth.uid() is null or new.owner_id is distinct from auth.uid() then
    raise exception 'Authenticated owner submission required';
  end if;
  select profile.is_suspended into suspended
  from public.profiles profile
  where profile.id = new.owner_id;
  if coalesce(suspended, true) then raise exception 'Suspended accounts cannot submit platform subscriptions'; end if;
  if new.status <> 'pending' then raise exception 'Subscription applications must start pending'; end if;
  return new;
end;
$$;
drop trigger if exists listing_promotions_submission_guard on public.listing_promotions;
create trigger listing_promotions_submission_guard
before insert on public.listing_promotions
for each row execute function public.guard_subscription_payment_submission();
drop trigger if exists pro_store_applications_submission_guard on public.pro_store_applications;
create trigger pro_store_applications_submission_guard
before insert on public.pro_store_applications
for each row execute function public.guard_subscription_payment_submission();

create or replace function public.prevent_classified_only_privileged_field_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and not public.is_admin()
     and coalesce(current_setting('ekrrili.platform_subscription_update', true), '') <> 'on' then
    if tg_table_name = 'listings' then
      if new.is_featured is distinct from old.is_featured
         or new.featured_until is distinct from old.featured_until then
        raise exception 'Only verified payments or administrators can change featured status';
      end if;
    elsif tg_table_name = 'profiles' then
      if new.is_pro_store is distinct from old.is_pro_store
         or new.pro_until is distinct from old.pro_until
         or new.store_name is distinct from old.store_name
         or new.store_slug is distinct from old.store_slug
         or new.store_bio is distinct from old.store_bio
         or new.store_wilaya is distinct from old.store_wilaya
         or new.business_hours is distinct from old.business_hours
         or new.map_location is distinct from old.map_location then
        raise exception 'Only verified payments or administrators can change Pro Store status';
      end if;
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.review_listing_promotion(
  promotion_id uuid,
  decision text,
  note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  promotion public.listing_promotions%rowtype;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if decision not in ('approved', 'rejected') then raise exception 'Invalid promotion review decision'; end if;
  select * into promotion
  from public.listing_promotions
  where id = promotion_id and status = 'pending'
  for update;
  if not found then raise exception 'Pending promotion request not found'; end if;
  update public.listing_promotions
  set status = decision,
      reviewed_at = now(),
      rejection_note = case when decision = 'rejected' then nullif(trim(note), '') end
  where id = promotion_id;
  if decision = 'approved' then
    perform set_config('ekrrili.platform_subscription_update', 'on', true);
    update public.listings
    set is_featured = true,
        featured_until = now() + make_interval(days => promotion.duration_days),
        featured_expiration_notified_at = null
    where id = promotion.listing_id;
  end if;
end;
$$;
revoke all on function public.review_listing_promotion(uuid, text, text) from public, anon;
grant execute on function public.review_listing_promotion(uuid, text, text) to authenticated;
grant execute on function public.submit_listing_promotion(uuid, text, text, integer, text, numeric, text, text, text) to authenticated;

create or replace function public.review_pro_store_application(
  application_id uuid,
  decision text,
  rejection_message text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  application public.pro_store_applications%rowtype;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if decision not in ('approved', 'rejected') then raise exception 'Invalid review decision'; end if;
  select * into application
  from public.pro_store_applications
  where id = application_id and status = 'pending'
  for update;
  if not found then raise exception 'Pending Pro Store application not found'; end if;
  if decision = 'approved' and exists (
    select 1 from public.profiles
    where store_slug = application.store_slug and id <> application.owner_id
  ) then raise exception 'Store URL is already in use'; end if;
  update public.pro_store_applications
  set status = decision,
      rejection_note = case when decision = 'rejected' then nullif(trim(rejection_message), '') end,
      reviewed_at = now()
  where id = application_id;
  if decision = 'approved' then
    perform set_config('ekrrili.platform_subscription_update', 'on', true);
    update public.profiles as profile
    set is_pro_store = true,
        store_name = application.store_name,
        store_slug = application.store_slug,
        store_bio = application.store_bio,
        store_wilaya = application.wilaya,
        business_hours = application.business_hours,
        map_location = application.map_location,
        pro_until = greatest(coalesce(profile.pro_until, now()), now()) + make_interval(days => application.pro_days),
        pro_expiration_notified_at = null
    where id = application.owner_id;
  end if;
  insert into public.notifications (user_id, event_type, title, body, entity_id)
  values (
    application.owner_id,
    'promotion_status',
    case when decision = 'approved' then 'تم تفعيل متجر PRO' else 'تم رفض طلب متجر PRO' end,
    case when decision = 'approved'
      then 'تم تأكيد الدفع وتفعيل متجر ' || application.store_name || ' لمدة ' || application.pro_days || ' يوماً.'
      else coalesce(nullif(trim(rejection_message), ''), 'راجع بيانات التحويل ثم أعد تقديم الطلب.')
    end,
    application.id
  );
end;
$$;
revoke all on function public.review_pro_store_application(uuid, text, text) from public, anon;
grant execute on function public.review_pro_store_application(uuid, text, text) to authenticated;
grant execute on function public.submit_pro_store_application(text, text, text, jsonb, text, text, text, text, text, text, text, numeric, text) to authenticated;

create or replace function public.expire_pro_stores()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired_count integer := 0;
  expired_store record;
begin
  perform set_config('ekrrili.platform_subscription_update', 'on', true);
  for expired_store in
    update public.profiles
    set is_pro_store = false,
        pro_expiration_notified_at = now()
    where is_pro_store is true
      and pro_until is not null
      and pro_until <= now()
      and pro_expiration_notified_at is null
    returning id, store_name
  loop
    insert into public.notifications (user_id, event_type, title, body)
    values (
      expired_store.id,
      'promotion_status',
      'انتهى اشتراك متجر PRO',
      'انتهت مدة اشتراك متجر ' || coalesce(expired_store.store_name, 'PRO') || ' وأصبح غير ظاهر في دليل المتاجر.'
    );
    expired_count := expired_count + 1;
  end loop;
  return expired_count;
end;
$$;
revoke all on function public.expire_pro_stores() from public, anon;
grant execute on function public.expire_pro_stores() to authenticated;

create or replace view public.active_pro_stores
with (security_barrier = true)
as
select
  id as owner_id,
  store_name,
  store_slug,
  store_bio,
  store_wilaya,
  business_hours,
  map_location,
  phone_number,
  pro_until
from public.profiles
where is_pro_store is true
  and pro_until > now();
revoke all on public.active_pro_stores from public;
grant select on public.active_pro_stores to anon, authenticated;

comment on table public.listing_promotions is
  'Paid platform advertising placement requests. Rental payments and deposits remain peer-to-peer and off-platform.';
comment on table public.pro_store_applications is
  'Paid subscriptions for platform Pro Store storefront services; unrelated to rental payments.';

-- Starter subscriptions and promotional trials for platform advertising only.
-- Rental payments, deposits, and physical handovers remain peer-to-peer.

alter table public.platform_settings
  add column if not exists promo_codes jsonb not null default '[]'::jsonb;

create or replace function public.validate_fixed_subscription_plan_durations()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  plan jsonb;
  plan_count integer := 0;
begin
  if jsonb_typeof(new.promotion_plans) is distinct from 'array'
     or jsonb_array_length(new.promotion_plans) <> 3 then
    raise exception 'Exactly three platform subscription plans are required';
  end if;
  for plan in select value from jsonb_array_elements(new.promotion_plans)
  loop
    plan_count := plan_count + 1;
    if (plan->>'id' = 'plan_7d' and ((plan->>'duration_days')::integer <> 7 or plan->>'name' <> 'باقة 7 أيام - أسبوع'))
       or (plan->>'id' = 'plan_15d' and ((plan->>'duration_days')::integer <> 15 or plan->>'name' <> 'خطة 15 يوم'))
       or (plan->>'id' = 'plan_30d' and ((plan->>'duration_days')::integer <> 30 or plan->>'name' <> 'خطة 30 يوم - شهر كامل'))
       or plan->>'id' not in ('plan_7d', 'plan_15d', 'plan_30d') then
      raise exception 'Official plan durations are fixed at 7, 15, and 30 days';
    end if;
  end loop;
  if plan_count <> 3 then raise exception 'Exactly three platform subscription plans are required'; end if;
  return new;
end;
$$;

update public.platform_settings
set promotion_plans = '[
  {"id":"plan_7d","name":"باقة 7 أيام - أسبوع","duration_days":7,"amount_dzd":300,"amount_usd":1.5,"enabled":true},
  {"id":"plan_15d","name":"خطة 15 يوم","duration_days":15,"amount_dzd":600,"amount_usd":3,"enabled":true},
  {"id":"plan_30d","name":"خطة 30 يوم - شهر كامل","duration_days":30,"amount_dzd":1000,"amount_usd":5,"enabled":true}
]'::jsonb
where id = 'promotion_payments'
  and not (
    select count(*) = 3
    from jsonb_array_elements(promotion_plans) as plans(plan)
    where plan->>'id' in ('plan_7d', 'plan_15d', 'plan_30d')
  );

alter table public.listing_promotions
  drop constraint if exists listing_promotions_pending_payment_details_required,
  add constraint listing_promotions_pending_payment_details_required check (
    status <> 'pending'
    or (
      plan_id in ('plan_7d', 'plan_15d', 'plan_30d')
      and duration_days in (7, 15, 30)
      and payment_method is not null
      and payment_reference is not null
      and sender_info is not null
      and (
        (currency = 'DZD' and amount_dzd is not null and amount_usd is null and payment_method in ('baridimob', 'ccp') and receipt_image_url is not null)
        or (currency = 'USD' and amount_usd is not null and amount_dzd is null and payment_method = 'bybit')
      )
    )
  );

alter table public.pro_store_applications
  drop constraint if exists pro_store_applications_checkout_plan,
  add constraint pro_store_applications_checkout_plan check (
    plan_id is null or plan_id in ('plan_7d', 'plan_15d', 'plan_30d')
  );

create table if not exists public.promotion_promo_redemptions (
  code text not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key (code, user_id)
);

alter table public.promotion_promo_redemptions enable row level security;
revoke all on public.promotion_promo_redemptions from public, anon, authenticated;
drop policy if exists "Admins read promotional code redemptions" on public.promotion_promo_redemptions;
create policy "Admins read promotional code redemptions"
on public.promotion_promo_redemptions for select to authenticated
using (public.is_admin());
grant select on public.promotion_promo_redemptions to authenticated;

create or replace function public.redeem_featured_promo_code(
  requested_listing_id uuid,
  requested_code text
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  settings_row public.platform_settings%rowtype;
  promo jsonb;
  promo_index bigint;
  use_limit integer;
  uses_so_far integer;
  trial_days integer;
  expiration timestamptz;
  listing_owner uuid;
  listing_status text;
  currently_featured boolean;
begin
  if actor_id is null then raise exception 'Authentication required'; end if;
  if coalesce(trim(requested_code), '') !~ '^[A-Za-z0-9_-]{3,32}$' then
    raise exception 'Invalid promotional code';
  end if;

  select * into settings_row
  from public.platform_settings
  where id = 'promotion_payments'
  for update;
  if not found then raise exception 'Promotion settings are unavailable'; end if;

  select entry.value, entry.ordinality
    into promo, promo_index
  from jsonb_array_elements(settings_row.promo_codes) with ordinality as entry(value, ordinality)
  where upper(entry.value->>'code') = upper(trim(requested_code))
    and coalesce((entry.value->>'active')::boolean, false)
  limit 1;
  if promo is null then raise exception 'Promotional code is invalid or inactive'; end if;

  trial_days := (promo->>'duration_days')::integer;
  use_limit := nullif(promo->>'max_uses', '')::integer;
  select count(*)::integer into uses_so_far
  from public.promotion_promo_redemptions
  where code = upper(trim(requested_code));
  if trial_days not in (7, 14) then raise exception 'Invalid promotional code duration'; end if;
  if use_limit is not null and uses_so_far >= use_limit then raise exception 'Promotional code has reached its usage limit'; end if;
  if exists (
    select 1 from public.promotion_promo_redemptions
    where code = upper(trim(requested_code)) and user_id = actor_id
  ) then raise exception 'Promotional code has already been used by this account'; end if;

  select listing.owner_id, listing.status,
         listing.is_featured and listing.featured_until > now()
    into listing_owner, listing_status, currently_featured
  from public.listings as listing
  where listing.id = requested_listing_id
  for update;
  if not found or listing_owner is distinct from actor_id then
    raise exception 'Listing not found or not owned by the current user';
  end if;
  if listing_status <> 'active' then raise exception 'Only active listings can use a promotional code'; end if;
  if currently_featured then raise exception 'Listing already has an active promotion'; end if;
  if exists (select 1 from public.profiles where id = actor_id and is_suspended is true) then
    raise exception 'Suspended accounts cannot redeem promotional codes';
  end if;

  insert into public.promotion_promo_redemptions (code, user_id, listing_id)
  values (upper(trim(requested_code)), actor_id, requested_listing_id);
  update public.platform_settings
  set promo_codes = (
    select jsonb_agg(
      case when entry.ordinality = promo_index then
        jsonb_set(
          entry.value,
          '{redeemed_count}',
          to_jsonb(uses_so_far + 1),
          true
        )
      else entry.value end
      order by entry.ordinality
    )
    from jsonb_array_elements(promo_codes) with ordinality as entry(value, ordinality)
  )
  where id = 'promotion_payments';

  expiration := now() + make_interval(days => trial_days);
  perform set_config('ekrrili.platform_subscription_update', 'on', true);
  update public.listings
  set is_featured = true,
      featured_until = expiration,
      featured_expiration_notified_at = null
  where id = requested_listing_id;
  insert into public.notifications (user_id, event_type, title, body, entity_id)
  values (
    actor_id,
    'promotion_status',
    'تم تفعيل التمييز المجاني',
    'تم تفعيل تمييز إعلانك لمدة ' || trial_days || ' أيام باستخدام رمز ترويجي.',
    requested_listing_id
  );
  return expiration;
end;
$$;

revoke all on function public.redeem_featured_promo_code(uuid, text) from public, anon;
grant execute on function public.redeem_featured_promo_code(uuid, text) to authenticated;

-- Keep payment settings validation aligned with the supported 7/15/30-day plans.
create or replace function public.validate_promotion_plan_settings()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  plan jsonb;
  plan_ids text[];
  plan_count integer := 0;
  distinct_plan_count integer;
begin
  if new.ccp_account_number !~ '^[0-9]{1,30}$' and new.ccp_account_number <> '' then raise exception 'Invalid CCP account number'; end if;
  if new.baridimob_rip !~ '^[0-9]{1,40}$' and new.baridimob_rip <> '' then raise exception 'Invalid BaridiMob RIP'; end if;
  if new.ccp_key !~ '^[0-9]{1,40}$' and new.ccp_key <> '' then raise exception 'Invalid CCP key'; end if;
  if length(new.account_holder_name) > 120 or length(new.support_phone) > 40 or length(new.ccp_key) > 40
     or length(new.bybit_uid) > 80 or length(new.usdt_wallet_address) > 120
     or length(new.bybit_pay_qr_url) > 2048 then
    raise exception 'Payment settings value is too long';
  end if;
  if new.bybit_pay_qr_url <> '' and new.bybit_pay_qr_url !~ '^https://[^[:space:]]+$' then
    raise exception 'Bybit Pay QR URL must use HTTPS';
  end if;
  if jsonb_typeof(new.promotion_plans) is distinct from 'array'
     or jsonb_array_length(new.promotion_plans) not between 2 and 5 then
    raise exception 'Between two and five promotion plans are required';
  end if;
  for plan in select value from jsonb_array_elements(new.promotion_plans)
  loop
    plan_count := plan_count + 1;
    if coalesce(plan->>'id', '') not in ('plan_7d', 'plan_15d', 'plan_30d')
       or coalesce(plan->>'name', '') = '' or length(plan->>'name') > 100
       or coalesce(plan->>'duration_days', '') !~ '^[0-9]+$'
       or (plan->>'duration_days')::integer not between 1 and 365
       or coalesce(plan->>'amount_dzd', '') !~ '^[0-9]+$'
       or (plan->>'amount_dzd')::integer not between 1 and 100000000
       or coalesce(plan->>'amount_usd', '') !~ '^[0-9]+([.][0-9]{1,2})?$'
       or (plan->>'amount_usd')::numeric not between 0.01 and 100000
       or coalesce(plan->>'enabled', 'true') not in ('true', 'false') then
      raise exception 'Invalid promotion plan entry';
    end if;
  end loop;
  select array_agg(value->>'id') into plan_ids from jsonb_array_elements(new.promotion_plans) as plans(value);
  select count(distinct value->>'id') into distinct_plan_count
  from jsonb_array_elements(new.promotion_plans) as plans(value);
  if cardinality(plan_ids) <> plan_count or distinct_plan_count <> plan_count then
    raise exception 'Promotion plan IDs must be unique';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

update public.platform_settings
set promotion_plans = '[
  {"id":"plan_7d","name":"باقة 7 أيام - أسبوع","duration_days":7,"amount_dzd":300,"amount_usd":1.5,"enabled":true},
  {"id":"plan_15d","name":"خطة 15 يوم","duration_days":15,"amount_dzd":600,"amount_usd":3,"enabled":true},
  {"id":"plan_30d","name":"خطة 30 يوم - شهر كامل","duration_days":30,"amount_dzd":1000,"amount_usd":5,"enabled":true}
]'::jsonb
where id = 'promotion_payments'
  and not (
    select count(*) = 3
    from jsonb_array_elements(promotion_plans) as plans(plan)
    where plan->>'id' in ('plan_7d', 'plan_15d', 'plan_30d')
  );
