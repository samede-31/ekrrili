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
